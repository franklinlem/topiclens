"use client";

import React, { useMemo, useState, useRef } from "react";
import { DocumentScatterPoint } from "@/lib/api-client";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";

interface ClusterScatterPlotProps {
  points: DocumentScatterPoint[];
  onSelectPoint: (point: DocumentScatterPoint) => void;
  selectedCluster: number | null;
  selectedPointId?: string | null;
}

export const CLUSTER_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#d946ef", // Fuchsia
  "#e11d48", // Rose
];

export const getClusterColor = (clusterLabel: number): string => {
  if (clusterLabel === -1) return "#64748b"; // Ruído (Slate)
  return CLUSTER_COLORS[clusterLabel % CLUSTER_COLORS.length];
};

export const ClusterScatterPlot: React.FC<ClusterScatterPlotProps> = ({
  points,
  onSelectPoint,
  selectedCluster,
  selectedPointId,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<DocumentScatterPoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Normalização de coordenadas para escala SVG (800x600)
  const { normalizedPoints, width, height } = useMemo(() => {
    const w = 840;
    const h = 580;
    if (!points.length) return { normalizedPoints: [], width: w, height: h };

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 48;
    const scaleX = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2);
    const scaleY = (y: number) => pad + ((y - minY) / (maxY - minY || 1)) * (h - pad * 2);

    return {
      normalizedPoints: points.map((p) => ({
        ...p,
        svgX: scaleX(p.x),
        svgY: scaleY(p.y),
      })),
      width: w,
      height: h,
    };
  }, [points]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Inicia Pan apenas com botão esquerdo e se clicar no fundo SVG
    if ((e.target as HTMLElement).tagName === "rect" || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative bg-slate-950/90 border border-slate-800 rounded-2xl p-4 shadow-2xl overflow-hidden select-none">
      {/* Barra superior de informações e controles */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Mapa de Projeção Semântica 2D</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {points.length} documentos
          </span>
          {selectedCluster !== null && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${getClusterColor(selectedCluster)}22`,
                color: getClusterColor(selectedCluster),
                border: `1px solid ${getClusterColor(selectedCluster)}66`,
              }}
            >
              {selectedCluster === -1 ? "Filtrado: Ruído" : `Filtrado: Cluster #${selectedCluster}`}
            </span>
          )}
        </div>

        {/* Controles de Zoom e Reset */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 4))}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.7))}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Redefinir Posição"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Área Gráfica SVG */}
      <div
        className={`relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-900 bg-slate-950 ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.15s ease-out",
          }}
        >
          {/* Grade de coordenadas decorativa */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            {/* Efeito Glow para exemplares */}
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Renderização dos Pontos */}
          {normalizedPoints.map((point) => {
            const isNoise = point.cluster_label === -1;
            const color = getClusterColor(point.cluster_label);

            const isDimmed = selectedCluster !== null && point.cluster_label !== selectedCluster;
            const isHovered = hoveredPoint?.id === point.id;
            const isSelected = selectedPointId === point.id;

            // Raio dinâmico
            let radius = point.is_exemplar ? 6.5 : 3.5;
            if (isHovered) radius += 2.5;
            if (isSelected) radius += 3;

            return (
              <g key={point.id} className="cursor-pointer">
                {/* Halo para ponto selecionado ou exemplar */}
                {(isSelected || (point.is_exemplar && !isDimmed)) && (
                  <circle
                    cx={point.svgX}
                    cy={point.svgY}
                    r={radius + 4}
                    fill="none"
                    stroke={isSelected ? "#38bdf8" : color}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeOpacity={0.6}
                    strokeDasharray={isSelected ? "3 3" : "none"}
                    className={isSelected ? "animate-spin origin-center" : ""}
                  />
                )}

                <circle
                  cx={point.svgX}
                  cy={point.svgY}
                  r={radius}
                  fill={color}
                  opacity={isDimmed ? 0.12 : isNoise ? 0.45 : 0.9}
                  stroke={point.is_exemplar ? "#ffffff" : isHovered ? "#ffffff" : "none"}
                  strokeWidth={point.is_exemplar ? 2 : isHovered ? 1.5 : 0}
                  className="transition-all duration-100"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPoint(point);
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip de Hover Dinâmico */}
        {hoveredPoint && (
          <div className="absolute bottom-4 left-4 max-w-sm bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-slate-200 pointer-events-none z-30 transition-all">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-800"
                style={{ backgroundColor: getClusterColor(hoveredPoint.cluster_label) }}
              />
              <span className="font-semibold text-slate-100 text-[13px]">
                {hoveredPoint.cluster_label === -1
                  ? "Ruído / Não Agrupado"
                  : `Cluster #${hoveredPoint.cluster_label}`}
              </span>
              {hoveredPoint.is_exemplar && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold">
                  Exemplar Central
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-slate-300 italic text-[11px] leading-relaxed">
              "{hoveredPoint.text_snippet}"
            </p>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>X: {hoveredPoint.x.toFixed(2)} | Y: {hoveredPoint.y.toFixed(2)}</span>
              <span className="text-indigo-400 font-sans">Clique para inspecionar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

