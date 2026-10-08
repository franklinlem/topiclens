"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, Dataset } from "@/lib/api-client";
import {
  Layers,
  PlusCircle,
  BarChart3,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Database,
  ArrowRight
} from "lucide-react";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listDatasets();
      setDatasets(data);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com a API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Deseja realmente excluir este dataset e seus tópicos?")) return;
    try {
      setDeletingId(id);
      await api.deleteDataset(id);
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert("Erro ao excluir dataset: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalDocs = datasets.reduce((acc, d) => acc + d.document_count, 0);
  const completedDatasets = datasets.filter((d) => d.status === "COMPLETED").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Banner de Boas-Vindas & Métricas */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>Painel de Datasets</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                TopicLens AI v0.1
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Agrupamento semântico não-supervisionado com representações densas, projeção dimensional UMAP e síntese de tópicos via LLM.
            </p>
          </div>

          <Link
            href="/datasets/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Dataset</span>
          </Link>
        </div>

        {/* Cards de Métricas do Sistema */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total de Datasets</p>
              <h3 className="text-2xl font-bold text-white font-mono">{datasets.length}</h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Análises Concluídas</p>
              <h3 className="text-2xl font-bold text-white font-mono">{completedDatasets}</h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Documentos Ingeridos</p>
              <h3 className="text-2xl font-bold text-white font-mono">{totalDocs}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela / Grid de Datasets */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Bases de Texto Ingeridas
          </h2>
          <button
            onClick={fetchDatasets}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Carregando datasets cadastrados...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : datasets.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-800/80 rounded-xl">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Nenhum dataset cadastrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Envie um arquivo CSV com textos (avaliações, chamados de suporte ou feedback) para iniciar o agrupamento.
            </p>
            <Link
              href="/datasets/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Ingestar Primeiro Arquivo
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-3 pl-2">Nome do Dataset</th>
                  <th className="pb-3">Documentos</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Criado em</th>
                  <th className="pb-3 pr-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {datasets.map((dataset) => {
                  return (
                    <tr key={dataset.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pl-2 font-medium text-slate-200">
                        <Link
                          href={`/analysis/${dataset.id}`}
                          className="hover:text-indigo-400 flex flex-col group"
                        >
                          <span className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300">
                            {dataset.name}
                          </span>
                          {dataset.description && (
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                              {dataset.description}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="py-3.5 font-mono text-slate-300">
                        {dataset.document_count}
                      </td>
                      <td className="py-3.5">
                        {dataset.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </span>
                        )}
                        {dataset.status === "PROCESSING" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {dataset.progress_percent}% Processando
                          </span>
                        )}
                        {dataset.status === "UPLOADED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Aguardando Análise
                          </span>
                        )}
                        {dataset.status === "FAILED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Falha
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-400 text-[11px] font-mono">
                        {new Date(dataset.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/analysis/${dataset.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium transition-all"
                          >
                            <span>Abrir</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                          <button
                            onClick={(e) => handleDelete(dataset.id, e)}
                            disabled={deletingId === dataset.id}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Excluir dataset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

