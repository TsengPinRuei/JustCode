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

    const clampPercent = useCallback((value: number): number => {
        return Math.min(100, Math.max(0, value));
    }, []);

    const clampSizeByConstraints = useCallback((rawSize: number): number => {
        const container = containerRef.current;
        if (!container) return clampPercent(rawSize);

        // 像素最小值會依目前 container 尺寸轉成百分比。
        const rect = container.getBoundingClientRect();
        const containerSize = direction === 'horizontal' ? rect.width : rect.height;
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

        // 若兩側最小像素限制無法同時滿足，優先保持 secondary pane 可見。
        if (minBound > maxBound) {
            return clampPercent(maxBound);
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

    const handleMouseDown = () => {
        setIsDragging(true);
    };

    useEffect(() => {
        const updateSizeFromPointer = (pointer: { clientX: number; clientY: number }) => {
            const container = containerRef.current;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            let newSize: number;

            if (direction === 'horizontal') {
                newSize = ((pointer.clientX - containerRect.left) / containerRect.width) * 100;
            } else {
                newSize = ((pointer.clientY - containerRect.top) / containerRect.height) * 100;
            }

            const nextSize = clampSizeByConstraints(newSize);
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

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

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

        const handleMouseUp = () => {
            flushPendingPointer();
            setIsDragging(false);
        };

        if (isDragging) {
            // 監聽 document，讓指標離開分隔線後仍可繼續拖曳。
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            cancelPendingFrame();
            pendingPointerRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, direction, clampSizeByConstraints]);

    // resize/prop 變更後重新套用限制，確保像素最小值仍有效。
    useEffect(() => {
        const syncSize = () => setSize((prev) => clampSizeByConstraints(prev));
        syncSize();
        window.addEventListener('resize', syncSize);
        return () => window.removeEventListener('resize', syncSize);
    }, [clampSizeByConstraints]);

    if (direction === 'vertical') {
        return (
            <div className="resizable-split-pane vertical" ref={containerRef}>
                <div className="split-pane-top" style={{ height: `${size}%` }}>
                    {top}
                </div>
                <div
                    className={`split-pane-divider horizontal ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={handleMouseDown}
                >
                    <div className="divider-line"></div>
                </div>
                <div className="split-pane-bottom" style={{ height: `${100 - size}%` }}>
                    {bottom}
                </div>
            </div>
        );
    }

    return (
        <div className="resizable-split-pane horizontal" ref={containerRef}>
            <div className="split-pane-left" style={{ width: `${size}%` }}>
                {left}
            </div>
            <div
                className={`split-pane-divider vertical ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
            >
                <div className="divider-line"></div>
            </div>
            <div className="split-pane-right" style={{ width: `${100 - size}%` }}>
                {right}
            </div>
        </div>
    );
};

export default ResizableSplitPane;
