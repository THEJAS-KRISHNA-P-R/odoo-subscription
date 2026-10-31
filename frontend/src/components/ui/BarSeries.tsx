'use client';

import React, { useState } from 'react';
import { formatMinor } from '@/lib/money';
import { EmptyState } from './EmptyState';

export interface BarDatum {
  label: string;
  valueMinor: number;
}

export interface BarSeriesProps {
  data: BarDatum[];
  emptyMessage?: string;
}

export function BarSeries({
  data,
  emptyMessage = 'No monthly revenue data available for the selected range.',
}: BarSeriesProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const maxMinor = Math.max(...data.map((d) => d.valueMinor), 1);
  const svgHeight = 240;
  const chartTop = 32;
  const chartBottom = 196;
  const plotHeight = chartBottom - chartTop;
  const slotWidth = Math.max(64, Math.floor(720 / Math.max(data.length, 1)));
  const svgWidth = Math.max(600, data.length * slotWidth + 40);
  const barWidth = Math.min(44, Math.max(24, slotWidth - 24));

  return (
    <div className="bg-[var(--bg-surface)] rounded-[24px] p-7 overflow-x-auto">
      <div className="relative min-w-[540px]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-[240px] overflow-visible"
          role="img"
          aria-label="Monthly revenue bar chart"
        >
          {/* Subtle horizontal guide lines */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = chartBottom - ratio * plotHeight;
            return (
              <line
                key={idx}
                x1={16}
                x2={svgWidth - 16}
                y1={y}
                y2={y}
                stroke="var(--border-hair)"
                strokeDasharray={ratio === 0 ? undefined : '4 4'}
                strokeWidth="1"
              />
            );
          })}

          {data.map((item, idx) => {
            const barHeight = Math.max(12, Math.round((item.valueMinor / maxMinor) * plotHeight));
            const x = 28 + idx * slotWidth + (slotWidth - barWidth) / 2;
            const y = chartBottom - barHeight;
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={item.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={12}
                  ry={12}
                  fill={isHovered ? '#8EE05B' : '#9FE870'}
                  className="transition-colors duration-150"
                />
                <text
                  x={x + barWidth / 2}
                  y={chartBottom + 24}
                  textAnchor="middle"
                  className="fill-[var(--text-secondary)] text-[12px] font-medium tabular-nums"
                >
                  {item.label}
                </text>
                {isHovered && (
                  <g>
                    <rect
                      x={Math.max(8, x + barWidth / 2 - 58)}
                      y={Math.max(2, y - 34)}
                      width={116}
                      height={26}
                      rx={13}
                      fill="#163300"
                    />
                    <text
                      x={Math.max(66, x + barWidth / 2)}
                      y={Math.max(19, y - 17)}
                      textAnchor="middle"
                      className="fill-white text-[11px] font-semibold tabular-nums"
                    >
                      {formatMinor(item.valueMinor)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
