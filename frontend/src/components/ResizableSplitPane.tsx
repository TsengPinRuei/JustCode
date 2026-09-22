import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ResizableSplitPane.css';

interface ResizableSplitPaneProps {
    left?: React.ReactNode;
    right?: React.ReactNode;
    top?: React.ReactNode;
    bottom?: React.ReactNode;
    // Initial left-pane size as a percentage of the available pane space.
    defaultLeftWidth?: number;
    // Initial top-pane size as a percentage of the available pane space.
    defaultTopHeight?: number;
    direction?: 'horizontal' | 'vertical';
    minSizePercent?: number;
    maxSizePercent?: number;
    // Minimum left width or top height in pixels, when both pane minimums fit.
    minPrimarySizePx?: number;
    // Minimum right width or bottom height in pixels, when both pane minimums fit.
    minSecondarySizePx?: number;
}

// Resize the leading pane using percentage bounds and optional pixel minimums.
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
    // Store a percentage so the split follows container resizing.
    const [size, setSize] = useState(direction === 'horizontal' ? defaultLeftWidth : defaultTopHeight);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    // Pointer events may arrive faster than rendering; retain only the newest position per frame.
    const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const activePointerRef = useRef<number | null>(null);

    const clampPercent = useCallback((value: number): number => {
        return Math.min(100, Math.max(0, value));
    }, []);

    const clampSizeByConstraints = useCallback((rawSize: number, measuredSize?: number): number => {
        const container = containerRef.current;
        if (!container) return clampPercent(rawSize);

        const rect = measuredSize === undefined ? container.getBoundingClientRect() : null;
        // Convert pixel minimums using the space left after the divider's 8 px hit area.
        // Keep this subtraction in sync with ResizableSplitPane.css and the drag calculation.
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
        // Capture the pointer so dragging continues outside the divider.
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
            // Reserve the same 8 px divider hit area used by clampSizeByConstraints and CSS.
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

        // Apply the last queued pointer position before ending the drag.
        const flushPendingPointer = () => {
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

            // Limit drag layout measurements and size updates to one animation frame.
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

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        // End the drag on cancellation or window blur if pointerup never arrives.
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

    // Reapply size constraints after container or prop changes.
    // If both minimums cannot fit, keep both panes visible using the fallback above.
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
