/**
 * Resizable Split Pane - A draggable divider between two panels.
 * Supports horizontal (left/right) and vertical (top/bottom) layouts.
 * Supports both percentage bounds and minimum pixel sizes per pane.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ResizableSplitPane.css';

interface ResizableSplitPaneProps {
    left?: React.ReactNode;
    right?: React.ReactNode;
    top?: React.ReactNode;
    bottom?: React.ReactNode;
    defaultLeftWidth?: number; // Percentage (for horizontal)
    defaultTopHeight?: number; // Percentage (for vertical)
    direction?: 'horizontal' | 'vertical';
    minSizePercent?: number;
    maxSizePercent?: number;
    minPrimarySizePx?: number;   // left width (horizontal) / top height (vertical)
    minSecondarySizePx?: number; // right width (horizontal) / bottom height (vertical)
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
    // Store the primary pane size as a percentage so layout scales with the container.
    const [size, setSize] = useState(direction === 'horizontal' ? defaultLeftWidth : defaultTopHeight);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    // Mousemove can fire much faster than React can render; keep only the latest pointer per frame.
    const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const dragFrameRef = useRef<number | null>(null);

    const clampPercent = useCallback((value: number): number => {
        return Math.min(100, Math.max(0, value));
    }, []);

    const clampSizeByConstraints = useCallback((rawSize: number): number => {
        const container = containerRef.current;
        if (!container) return clampPercent(rawSize);

        // Pixel minimums are converted to percentages against the current container size.
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

        // If both min pixel constraints cannot be satisfied, prioritize keeping the secondary pane visible.
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
            // Apply the last queued pointer position before ending drag so the pane does not lag behind.
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

            // Throttle layout reads/writes to animation frames during drag.
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
            // Listen on document so dragging continues even if the pointer leaves the divider.
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

    // Re-apply constraints after resize/prop changes so pixel minimums stay valid.
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
