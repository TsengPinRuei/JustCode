/**
 * 可調整大小的 Split Pane：在兩個 panel 之間提供可拖曳分隔線。
 * 支援水平（左/右）與垂直（上/下）布局。
 * 同時支援百分比邊界與每個 pane 的最小像素尺寸。
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ResizableSplitPane.css';

interface ResizableSplitPaneProps {
    left?: React.ReactNode;
    right?: React.ReactNode;
    top?: React.ReactNode;
    bottom?: React.ReactNode;
    defaultLeftWidth?: number; // 百分比（水平布局）
    defaultTopHeight?: number; // 百分比（垂直布局）
    direction?: 'horizontal' | 'vertical';
    minSizePercent?: number;
    maxSizePercent?: number;
    minPrimarySizePx?: number;   // 左側寬度（水平）/ 上方高度（垂直）
    minSecondarySizePx?: number; // 右側寬度（水平）/ 下方高度（垂直）
}

const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
    left,
    right,
    top,
    bottom,
    defaultLeftWidth = 50,
    defaultTopHeight = 60,
    direction = 'horizontal',
    minSizePercent = 20,
    maxSizePercent = 80,
    minPrimarySizePx,
    minSecondarySizePx,
}) => {
    // 以百分比保存主要 pane 尺寸，讓布局可隨 container 縮放。
    const [size, setSize] = useState(direction === 'horizontal' ? defaultLeftWidth : defaultTopHeight);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    // mousemove 可能比 React render 更頻繁；每個 frame 只保留最新指標位置。
    const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const activePointerRef = useRef<number | null>(null);

    const clampPercent = useCallback((value: number): number => {
        return Math.min(100, Math.max(0, value));
    }, []);

    const clampSizeByConstraints = useCallback((rawSize: number, measuredSize?: number): number => {
        const container = containerRef.current;
        if (!container) return clampPercent(rawSize);

        // 像素最小值會依目前 container 尺寸轉成百分比。
        const rect = measuredSize === undefined ? container.getBoundingClientRect() : null;
        const containerSize = measuredSize ?? ((direction === 'horizontal' ? rect!.width : rect!.height) - 8);
        if (containerSize <= 0) return clampPercent(rawSize);

        let minBound = clampPercent(minSizePercent);
        let maxBound = clampPercent(maxSizePercent);
        if (minBound > maxBound) {
            [minBound, maxBound] = [maxBound, minBound];
        }

        if (typeof minPrimarySizePx === 'number' && minPrimarySizePx > 0) {
            minBound = Math.max(minBound, clampPercent((minPrimarySizePx / containerSize) * 100));
        }

        if (typeof minSecondarySizePx === 'number' && minSecondarySizePx > 0) {
            maxBound = Math.min(maxBound, 100 - clampPercent((minSecondarySizePx / containerSize) * 100));
        }

        // A narrow viewport cannot satisfy both pixel minima; keep both panes
        // visible instead of collapsing one to zero.
        if (minBound > maxBound) {
            return clampPercent((minBound + maxBound) / 2);
        }

        return clampPercent(Math.min(maxBound, Math.max(minBound, rawSize)));
    }, [
        clampPercent,
        direction,
        minSizePercent,
        maxSizePercent,
        minPrimarySizePx,
        minSecondarySizePx,
    ]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || activePointerRef.current !== null) return;
        activePointerRef.current = event.pointerId;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
    };

    const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const decrease = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
        const increase = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
        if (event.key !== decrease && event.key !== increase) return;
        event.preventDefault();
        setSize(previous => clampSizeByConstraints(previous + (event.key === increase ? 2 : -2)));
    };

    useEffect(() => {
        if (!isDragging) return;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        const updateSizeFromPointer = (pointer: { clientX: number; clientY: number }) => {
            const container = containerRef.current;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const containerSize = (direction === 'horizontal' ? containerRect.width : containerRect.height) - 8;
            if (containerSize <= 0) return;
            let newSize: number;

            if (direction === 'horizontal') {
                newSize = ((pointer.clientX - containerRect.left) / containerSize) * 100;
            } else {
                newSize = ((pointer.clientY - containerRect.top) / containerSize) * 100;
            }

            const nextSize = clampSizeByConstraints(newSize, containerSize);
            setSize((prev) => (Object.is(prev, nextSize) ? prev : nextSize));
        };

        const cancelPendingFrame = () => {
            if (dragFrameRef.current !== null) {
                window.cancelAnimationFrame(dragFrameRef.current);
                dragFrameRef.current = null;
            }
        };

        const flushPendingPointer = () => {
            // 結束拖曳前套用最後排隊的指標位置，避免 pane 落後。
            cancelPendingFrame();
            const pointer = pendingPointerRef.current;
            pendingPointerRef.current = null;
            if (pointer) {
                updateSizeFromPointer(pointer);
            }
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (e.pointerId !== activePointerRef.current) return;

            pendingPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
            if (dragFrameRef.current !== null) return;

            // 拖曳期間將 layout 讀寫節流到 animation frame。
            dragFrameRef.current = window.requestAnimationFrame(() => {
                dragFrameRef.current = null;
                const pointer = pendingPointerRef.current;
                pendingPointerRef.current = null;
                if (pointer) {
                    updateSizeFromPointer(pointer);
                }
            });
        };

        const handlePointerUp = (event: PointerEvent | Event) => {
            if ('pointerId' in event && event.pointerId !== activePointerRef.current) return;
            flushPendingPointer();
            setIsDragging(false);
        };

        // Capture keeps touch/mouse drags active outside the divider; blur and
        // pointercancel also end them when no ordinary pointerup arrives.
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handlePointerUp);
        window.addEventListener('blur', handlePointerUp);
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
            window.removeEventListener('blur', handlePointerUp);
            cancelPendingFrame();
            activePointerRef.current = null;
            pendingPointerRef.current = null;
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    }, [isDragging, direction, clampSizeByConstraints]);

    // resize/prop 變更後重新套用限制，確保像素最小值仍有效。
    useEffect(() => {
        const syncSize = () => setSize((prev) => clampSizeByConstraints(prev));
        syncSize();
        const observer = new ResizeObserver(syncSize);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [clampSizeByConstraints]);

    if (direction === 'vertical') {
        return (
            <div className="resizable-split-pane vertical" ref={containerRef}>
                <div className="split-pane-top" style={{ flex: `${size} 1 0` }}>
                    {top}
                </div>
                <div
                    className={`split-pane-divider horizontal ${isDragging ? 'dragging' : ''}`}
                    onPointerDown={handlePointerDown}
                    onKeyDown={handleDividerKeyDown}
                    role="separator"
                    tabIndex={0}
                    aria-label="Resize panels"
                    aria-valuenow={Math.round(size)}
                    aria-orientation="horizontal"
                >
                    <div className="divider-line"></div>
                </div>
                <div className="split-pane-bottom" style={{ flex: `${100 - size} 1 0` }}>
                    {bottom}
                </div>
            </div>
        );
    }

    return (
        <div className="resizable-split-pane horizontal" ref={containerRef}>
            <div className="split-pane-left" style={{ flex: `${size} 1 0` }}>
                {left}
            </div>
            <div
                className={`split-pane-divider vertical ${isDragging ? 'dragging' : ''}`}
                onPointerDown={handlePointerDown}
                onKeyDown={handleDividerKeyDown}
                role="separator"
                tabIndex={0}
                aria-label="Resize panels"
                aria-valuenow={Math.round(size)}
                aria-orientation="vertical"
            >
                <div className="divider-line"></div>
            </div>
            <div className="split-pane-right" style={{ flex: `${100 - size} 1 0` }}>
                {right}
            </div>
        </div>
    );
};

export default ResizableSplitPane;
