import { useEffect, useRef, useState } from 'react';

interface BinanceKline {
    0: number;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
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
    setData: (data: Array<{ time: number; open: number; high: number; low: number; close: number }>) => void;
    update: (bar: { time: number; open: number; high: number; low: number; close: number }) => void;
};

export function useBinanceChart({ coin }: UseBinanceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [price, setPrice] = useState<string>('...');

    useEffect(() => {
        if (!chartContainerRef.current) return;
        let chart: ChartApi | null = null;
        let series: SeriesApi | null = null;
        let isMounted = true;
        let ws: WebSocket | null = null;
        let cleanupResize: (() => void) | null = null;

        const initChart = async () => {
            const lightweightCharts = await import('lightweight-charts');
            const createChart = lightweightCharts.createChart as unknown as (container: HTMLElement, options: Record<string, unknown>) => ChartApi;
            const ColorType = lightweightCharts.ColorType as { Solid: string };

            if (!isMounted || !chartContainerRef.current) return;

            chart = createChart(chartContainerRef.current, {
                layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888' },
                grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
                rightPriceScale: { borderColor: '#333' }
            });

            series = chart.addCandlestickSeries({
                upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
                wickUpColor: '#10b981', wickDownColor: '#ef4444'
            });

            try {
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.toUpperCase()}USDT&interval=1h&limit=100`);
                const data = await res.json();
                const formattedData = (data as BinanceKline[]).map((d) => ({
                    time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]),
                    low: parseFloat(d[3]), close: parseFloat(d[4])
                }));
                if (isMounted && series) {
                    series.setData(formattedData);
                    if (formattedData.length > 0) {
                        const lastClose = formattedData[formattedData.length - 1].close;
                        setPrice(lastClose < 1 ? lastClose.toFixed(4) : lastClose.toFixed(2));
                    }
                }
            } catch (e) {
                console.error('Failed to fetch chart data', e);
            }

            if (!isMounted) return;

            const wsUrl = `wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@kline_1h`;
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data as string);
                    if (message && message.k) {
                        const k = message.k;
                        const bar = {
                            time: k.t / 1000,
                            open: parseFloat(k.o),
                            high: parseFloat(k.h),
                            low: parseFloat(k.l),
                            close: parseFloat(k.c)
                        };
                        if (series) series.update(bar);
                        const currentPrice = bar.close;
                        setPrice(currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2));
                    }
                } catch (err) {
                    console.error('WS parsing error', err);
                }
            };

            const resizeObserver = new ResizeObserver(() => {
                if (chartContainerRef.current && chart) {
                    const width = chartContainerRef.current.clientWidth;
                    const height = chartContainerRef.current.clientHeight;
                    if (width > 0 && height > 0) {
                        chart.applyOptions({ width, height });
                    }
                }
            });
            
            if (chartContainerRef.current) {
                resizeObserver.observe(chartContainerRef.current);
            }
            
            cleanupResize = () => resizeObserver.disconnect();
        };

        initChart();

        return () => {
            isMounted = false;
            if (ws) ws.close();
            if (cleanupResize) cleanupResize();
            if (chart) chart.remove();
            if (chartContainerRef.current) {
                chartContainerRef.current.innerHTML = '';
            }
        };
    }, [coin]);

    return { chartContainerRef, price };
}
