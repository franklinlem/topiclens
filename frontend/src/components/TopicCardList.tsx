"use client";

import React, { useState } from "react";
import { TopicSummary } from "@/lib/api-client";
import { getClusterColor } from "./ClusterScatterPlot";
import { Sparkles, Hash, Search, Tag, Eye } from "lucide-react";

interface TopicCardListProps {
  topics: TopicSummary[];
  selectedCluster: number | null;
  onSelectCluster: (clusterLabel: number | null) => void;
  totalDocuments: number;
}

export const TopicCardList: React.FC<TopicCardListProps> = ({
  topics,
  selectedCluster,
  onSelectCluster,
  totalDocuments,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTopics = topics.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.title.toLowerCase().includes(term) ||
      t.summary.toLowerCase().includes(term) ||
      t.keywords.some((k) => k.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-slate-100 text-sm">Tópicos Descobertos</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {topics.length}
          </span>
        </div>

        {selectedCluster !== null && (
          <button
            onClick={() => onSelectCluster(null)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-md bg-indigo-950/40 border border-indigo-800/40 transition-colors"
          >
            Limpar Filtro
          </button>
        )}
      </div>

      {/* Barra de Busca de Tópicos */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar tópicos ou palavras-chave..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Lista com Rolagem */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[460px]">
        {filteredTopics.map((topic) => {
          const isSelected = selectedCluster === topic.cluster_label;
          const isNoise = topic.cluster_label === -1;
          const clusterColor = getClusterColor(topic.cluster_label);

          return (
            <div
              key={topic.id}
              onClick={() => onSelectCluster(isSelected ? null : topic.cluster_label)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/30"
                  : "bg-slate-900/50 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700"
              }`}
            >
              {/* Título e Tags Superiores */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: clusterColor }}
                  />
                  <h4 className="font-semibold text-slate-100 text-xs line-clamp-1">
                    {topic.title}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${clusterColor}1a`,
                      color: clusterColor,
                    }}
                  >
                    {topic.percentage}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {topic.document_count} doc{topic.document_count > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso Visual de Representatividade */}
              <div className="w-full bg-slate-800/80 rounded-full h-1 mb-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, topic.percentage)}%`,
                    backgroundColor: clusterColor,
                  }}
                />
              </div>

              {/* Resumo Executivo */}
              <p className="text-[11px] text-slate-300 leading-relaxed mb-2 line-clamp-2">
                {topic.summary}
              </p>

              {/* Chips de Palavras-Chave */}
              {topic.keywords && topic.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {topic.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60"
                    >
                      <Tag className="w-2.5 h-2.5 opacity-60" />
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredTopics.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-500">
            Nenhum tópico corresponde à busca.
          </div>
        )}
      </div>
    </div>
  );
};

