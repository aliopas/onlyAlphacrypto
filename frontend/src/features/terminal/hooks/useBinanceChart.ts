import { useEffect, useRef, useState } from 'react';

interface UseBinanceChartProps {
    coin: string;
}

export function useBinanceChart({ coin }: UseBinanceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [price, setPrice] = useState<string>('...');

    useEffect(() => {
        if (!chartContainerRef.current) return;
        let chart: any;
        let isMounted = true;
        let ws: WebSocket | null = null;
        let candlestickSeries: any;

        const initChart = async () => {
            const { createChart, ColorType } = await import('lightweight-charts');

            if (!isMounted || !chartContainerRef.current) return;

            chart = createChart(chartContainerRef.current, {
                layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888' },
                grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
                rightPriceScale: { borderColor: '#333' }
            });

            candlestickSeries = chart.addCandlestickSeries({
                upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
                wickUpColor: '#10b981', wickDownColor: '#ef4444'
            });

            try {
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.toUpperCase()}USDT&interval=1h&limit=100`);
                const data = await res.json();
                const formattedData = data.map((d: any) => ({
                    time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]),
                    low: parseFloat(d[3]), close: parseFloat(d[4])
                }));
                if (isMounted) {
                    candlestickSeries.setData(formattedData);
                    if (formattedData.length > 0) {
                        const lastClose = formattedData[formattedData.length - 1].close;
                        setPrice(lastClose < 1 ? lastClose.toFixed(4) : lastClose.toFixed(2));
                    }
                }
            } catch (e) {
                console.error('Failed to fetch chart data', e);
            }

            if (!isMounted) return;

            // Connect WebSocket for live updates
            const wsUrl = `wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@kline_1h`;
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data);
                    if (message && message.k) {
                        const k = message.k;
                        const bar = {
                            time: k.t / 1000,
                            open: parseFloat(k.o),
                            high: parseFloat(k.h),
                            low: parseFloat(k.l),
                            close: parseFloat(k.c)
                        };
                        candlestickSeries.update(bar);
                        const currentPrice = bar.close;
                        setPrice(currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2));
                    }
                } catch (err) {
                    console.error('WS parsing error', err);
                }
            };

            const handleResize = () => {
                if (chartContainerRef.current && chart) {
                    chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
                }
            };
            window.addEventListener('resize', handleResize);
            chart.cleanupResize = () => window.removeEventListener('resize', handleResize);
        };

        initChart();

        return () => {
            isMounted = false;
            if (ws) ws.close();
            if (chart) {
                if (chart.cleanupResize) chart.cleanupResize();
                chart.remove();
            }
            if (chartContainerRef.current) {
                chartContainerRef.current.innerHTML = '';
            }
        };
    }, [coin]);

    return { chartContainerRef, price };
}
