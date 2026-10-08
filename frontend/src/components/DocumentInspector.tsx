"use client";

import React from "react";
import { DocumentDetail } from "@/lib/api-client";
import { getClusterColor } from "./ClusterScatterPlot";
import { X, FileText, CheckCircle2, MapPin, Database, Award } from "lucide-react";

interface DocumentInspectorProps {
  document: DocumentDetail | null;
  onClose: () => void;
}

export const DocumentInspector: React.FC<DocumentInspectorProps> = ({ document, onClose }) => {
  if (!document) return null;

  const clusterColor = getClusterColor(document.cluster_label);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-slate-100 text-sm">Inspeção de Documento</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo com rolagem */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status do Cluster */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-800"
              style={{ backgroundColor: clusterColor }}
            />
            <span className="font-semibold text-xs text-slate-200">
              {document.cluster_label === -1
                ? "Ruído / Não Agrupado"
                : `Cluster #${document.cluster_label}`}
            </span>
          </div>

          {document.is_exemplar && (
            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Award className="w-3 h-3" />
              Exemplar Central
            </span>
          )}
        </div>

        {/* Texto Completo */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Texto Original do Documento
          </label>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-500/30">
            {document.original_text}
          </div>
        </div>

        {/* Coordenadas 2D */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Projeção UMAP 2D
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Coordenada X</span>
              <span className="font-mono text-slate-200">{document.coord_x?.toFixed(4) ?? "N/A"}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Coordenada Y</span>
              <span className="font-mono text-slate-200">{document.coord_y?.toFixed(4) ?? "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Metadados Adicionais */}
        {document.metadata_json && Object.keys(document.metadata_json).length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Metadados do Registro
            </label>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden text-xs">
              <table className="w-full text-left">
                <tbody>
                  {Object.entries(document.metadata_json).map(([key, val], idx) => (
                    <tr key={key} className={idx > 0 ? "border-t border-slate-800/60" : ""}>
                      <td className="px-3 py-2 font-mono text-slate-400 text-[11px] w-1/3 bg-slate-900/40">
                        {key}
                      </td>
                      <td className="px-3 py-2 text-slate-200 text-[11px] font-mono break-all">
                        {String(val ?? "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

