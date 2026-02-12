import React, { useState, useRef, useEffect } from 'react';
import './ResizableSplitPane.css';

interface ResizableSplitPaneProps {
    left?: React.ReactNode;
    right?: React.ReactNode;
    top?: React.ReactNode;
    bottom?: React.ReactNode;
    defaultLeftWidth?: number; // Percentage (for horizontal)
    defaultTopHeight?: number; // Percentage (for vertical)
    direction?: 'horizontal' | 'vertical';
}

const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
    left,
    right,
    top,
    bottom,
    defaultLeftWidth = 50,
    defaultTopHeight = 60,
    direction = 'horizontal',
}) => {
    const [size, setSize] = useState(direction === 'horizontal' ? defaultLeftWidth : defaultTopHeight);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = () => {
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            let newSize: number;

            if (direction === 'horizontal') {
                newSize = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            } else {
                newSize = ((e.clientY - containerRect.top) / containerRect.height) * 100;
            }

            // Constrain between 20% and 80%
            if (newSize >= 20 && newSize <= 80) {
                setSize(newSize);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, direction]);

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
