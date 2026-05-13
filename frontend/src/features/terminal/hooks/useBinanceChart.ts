import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/features/shared/api/client';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const LOG_SCALE_THRESHOLD = 0.01;
const MICRO_PRICE_THRESHOLD = 1;
const PRICE_DECIMAL_PLACES = 6;
const PRICE_WHOLE_PLACES = 2;

interface ChartCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface ChartResponse {
    source: 'binance' | 'dex' | 'none';
    candles: ChartCandle[];
    price: string;
    symbol: string;
}

interface UseBinanceChartProps {
    coin: string;
}

type ChartApi = {
    applyOptions: (options: Record<string, unknown>) => void;
    remove: () => void;
    addCandlestickSeries: (options: Record<string, unknown>) => SeriesApi;
};

type SeriesApi = {
    setData: (data: ChartCandle[]) => void;
    update: (bar: ChartCandle) => void;
};

async function fetchChartData(symbol: string): Promise<ChartResponse> {
    const { data } = await apiClient.get<ChartResponse>(`/chart/klines/${symbol}`);
    return data;
}

export function useBinanceChart({ coin }: UseBinanceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [price, setPrice] = useState<string>('...');
    const [source, setSource] = useState<string>('none');
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        setPrice('...');
        setSource('none');
        setError(false);
        if (!chartContainerRef.current) return;

        let chart: ChartApi | null = null;
        let series: SeriesApi | null = null;
        let isMounted = true;
        let ws: WebSocket | null = null;
        let cleanupResize: (() => void) | null = null;

        const initChart = async () => {
            const lightweightCharts = await import('lightweight-charts');
            const createChart = lightweightCharts.createChart as unknown as (
                container: HTMLElement,
                options: Record<string, unknown>
            ) => ChartApi;
            const ColorType = lightweightCharts.ColorType as { Solid: string };
            const PriceScaleMode = lightweightCharts.PriceScaleMode as unknown as { Logarithmic: number };

            if (!isMounted || !chartContainerRef.current) return;

            const symbol = coin.toUpperCase();
            let response: ChartResponse;

            try {
                response = await fetchChartData(symbol);
            } catch (err) {
                console.error('[Chart] Backend proxy failed', err);
                setError(true);
                return;
            }

            if (!isMounted) return;

            const hasCandles = response.candles.length > 0;
            const lastClose = hasCandles ? response.candles[response.candles.length - 1].close : 0;
            const isLogScale = lastClose > 0 && lastClose < LOG_SCALE_THRESHOLD;

            chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: 'transparent' },
                    textColor: '#888',
                },
                grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
                rightPriceScale: {
                    borderColor: '#333',
                    ...(isLogScale ? { mode: PriceScaleMode.Logarithmic } : {}),
                },
                localization: { locale: 'en-US' },
            });

            series = chart.addCandlestickSeries({
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            });

            if (hasCandles) {
                series.setData(response.candles);
                setPrice(response.price);
                setSource(response.source);
            } else {
                setPrice(response.price);
                setSource(response.source);
            }

            if (response.source === 'binance') {
                const wsUrl = `${BINANCE_WS_URL}/${coin.toLowerCase()}usdt@kline_1h`;
                ws = new WebSocket(wsUrl);
                ws.onmessage = (event) => {
                    if (!isMounted) return;
                    try {
                        const msg = JSON.parse(event.data as string);
                        if (msg?.k) {
                            const k = msg.k;
                            const bar: ChartCandle = {
                                time: k.t / 1000,
                                open: parseFloat(k.o),
                                high: parseFloat(k.h),
                                low: parseFloat(k.l),
                                close: parseFloat(k.c),
                            };
                            if (series) series.update(bar);
                            setPrice(bar.close < MICRO_PRICE_THRESHOLD ? bar.close.toFixed(PRICE_DECIMAL_PLACES) : bar.close.toFixed(PRICE_WHOLE_PLACES));
                        }
                    } catch (err) {
                        console.error('[WS] parse error', err);
                    }
                };
            }

            if (!isMounted) return;

            const resizeObserver = new ResizeObserver(() => {
                if (chartContainerRef.current && chart) {
                    const w = chartContainerRef.current.clientWidth;
                    const h = chartContainerRef.current.clientHeight;
                    if (w > 0 && h > 0) chart.applyOptions({ width: w, height: h });
                }
            });
            if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);
            cleanupResize = () => resizeObserver.disconnect();
        };

        initChart();

        return () => {
            isMounted = false;
            if (ws) ws.close();
            if (cleanupResize) cleanupResize();
            if (chart) chart.remove();
        };
    }, [coin]);

    return { chartContainerRef, price, source, error };
}
