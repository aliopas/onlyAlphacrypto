import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/features/shared/api/client';

export type ChatMode = 'general' | 'private';

interface Message {
    role: 'ai' | 'user';
    content: string;
}

interface UseTerminalChatProps {
    coin: string;
    articleId?: number | null;
    articleType?: 'WIRE' | 'RADAR';
}

export function useTerminalChat({ coin, articleId, articleType }: UseTerminalChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: `Terminal Interface ready. Scanning data streams for $${coin}...` }
    ]);
    const [streaming, setStreaming] = useState(false);
    const [mode, setMode] = useState<ChatMode>('general');
    const [guestCount, setGuestCount] = useState(0);
    const [isGuestLocked, setIsGuestLocked] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);

    useEffect(() => {
        setMessages([{ role: 'ai', content: `Terminal Interface ready. Scanning data streams for $${coin}...` }]);
    }, [coin]);

    useEffect(() => {
        const storedCount = localStorage.getItem('guest_chat_count');
        if (storedCount) {
            setGuestCount(parseInt(storedCount, 10));
        }
        const token = localStorage.getItem('token');
        if (token) {
            setIsLoggedIn(true);
        } else if (storedCount && parseInt(storedCount, 10) >= 3) {
            setIsGuestLocked(true);
        }
    }, []);

    useEffect(() => {
        async function checkDisclaimer() {
            try {
                const { data } = await apiClient.get('/chat/disclaimer-status');
                setDisclaimerAccepted(data.accepted ?? false);
            } catch {
                setDisclaimerAccepted(false);
            }
        }
        checkDisclaimer();
    }, []);

    const acceptDisclaimer = useCallback(async () => {
        try {
            await apiClient.post('/chat/accept-disclaimer');
            setDisclaimerAccepted(true);
        } catch (error) {
            console.error('[Chat] Failed to accept disclaimer:', error);
        }
    }, []);

    const send = async (userMsg: string) => {
        if (!userMsg.trim() || streaming || isGuestLocked) return;
        if (disclaimerAccepted === false) return;
        if (disclaimerAccepted === null) return;

        const token = localStorage.getItem('token');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setStreaming(true);

        let aiBuffer = '';
        setMessages(prev => [...prev, { role: 'ai', content: '' }]);

        const contextMessages = [...messages, { role: 'user', content: userMsg }];
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
                body: JSON.stringify({ messages: contextMessages, coin, mode, articleId, articleType }),
            });

            if (!resp.ok) throw new Error('Failed to fetch');

            // Increment guest count ONLY IF request was successful and user is a guest
            if (!token) {
                const newCount = guestCount + 1;
                setGuestCount(newCount);
                localStorage.setItem('guest_chat_count', newCount.toString());
            }

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                text.split('\n').filter(l => l.startsWith('data:')).forEach(line => {
                    const chunk = line.replace('data:', '').trim();
                    if (chunk && chunk !== '[DONE]') { aiBuffer += chunk; }
                });
                setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: aiBuffer }]);
            }
        } catch {
            setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: 'Connection error. Please try again.' }]);
        } finally {
            setStreaming(false);
            // Check if we should lock NOW after the response finished
            const token = localStorage.getItem('token');
            const storedCount = localStorage.getItem('guest_chat_count');
            if (!token && storedCount && parseInt(storedCount, 10) >= 3) {
                setIsGuestLocked(true);
            }
        }
    };

    return { messages, streaming, mode, setMode, guestCount, isGuestLocked, isLoggedIn, send, disclaimerAccepted, acceptDisclaimer };
}
