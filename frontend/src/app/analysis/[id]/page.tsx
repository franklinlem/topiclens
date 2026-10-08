"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  api,
  Dataset,
  AnalysisResultsResponse,
  AnalysisProgressResponse,
  DocumentScatterPoint,
  DocumentDetail,
  ClusteringParameters,
} from "@/lib/api-client";
import { ClusterScatterPlot } from "@/components/ClusterScatterPlot";
import { TopicCardList } from "@/components/TopicCardList";
import { DocumentInspector } from "@/components/DocumentInspector";
import {
  Layers,
  ArrowLeft,
  Download,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Hash,
  Sparkles,
  PieChart,
  HelpCircle,
  Sliders,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AnalysisDashboardPage({ params }: PageProps) {
  const { id: datasetId } = use(params);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [results, setResults] = useState<AnalysisResultsResponse | null>(null);
  const [progress, setProgress] = useState<AnalysisProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Interatividade
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [inspectedDoc, setInspectedDoc] = useState<DocumentDetail | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Modal de Re-análise
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [reanalyzeParams, setReanalyzeParams] = useState<ClusteringParameters>({
    min_cluster_size: 15,
    min_samples: 5,
    n_neighbors_umap: 15,
    umap_components: 5,
    llm_model: "gpt-4o-mini",
  });

  const loadData = async () => {
    try {
      setError(null);
      const ds = await api.getDataset(datasetId);
      setDataset(ds);

      if (ds.status === "COMPLETED") {
        const res = await api.getAnalysisResults(datasetId);
        setResults(res);
      } else if (ds.status === "PROCESSING" || ds.status === "UPLOADED") {
        const prog = await api.getAnalysisStatus(datasetId);
        setProgress(prog);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do dataset");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [datasetId]);

  // Polling enquanto o dataset estiver em processamento
  useEffect(() => {
    if (!dataset || dataset.status !== "PROCESSING") return;

    const interval = setInterval(async () => {
      try {
        const prog = await api.getAnalysisStatus(datasetId);
        setProgress(prog);

        if (prog.status === "COMPLETED") {
          clearInterval(interval);
          setDataset((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
          const res = await api.getAnalysisResults(datasetId);
          setResults(res);
        } else if (prog.status === "FAILED") {
          clearInterval(interval);
          setDataset((prev) => (prev ? { ...prev, status: "FAILED" } : null));
          setError(prog.error_message || "Falha durante o processamento analítico");
        }
      } catch (err: any) {
        console.error("Erro no polling de status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [dataset?.status, datasetId]);

  const handleSelectPoint = async (point: DocumentScatterPoint) => {
    setSelectedPointId(point.id);
    try {
      const doc = await api.getDocumentDetail(datasetId, point.id);
      setInspectedDoc(doc);
    } catch (err: any) {
      console.error("Erro ao buscar detalhes do documento:", err);
    }
  };

  const handleTriggerAnalysis = async () => {
    try {
      setShowConfigModal(false);
      setLoading(true);
      await api.startAnalysis(datasetId, reanalyzeParams);
      setDataset((prev) => (prev ? { ...prev, status: "PROCESSING" } : null));
      setProgress({
        dataset_id: datasetId,
        status: "PROCESSING",
        progress_percent: 5,
        progress_message: "Iniciando esteira analítica...",
      });
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar análise");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dataset) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Carregando painel analítico do TopicLens...</p>
      </div>
    );
  }

  if (error && !dataset) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-rose-300 mb-1">Não foi possível carregar o dataset</h2>
        <p className="text-xs text-slate-400 mb-4">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Datasets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Barra Superior de Navegação e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>{dataset?.name}</span>
            </h1>
            <p className="text-xs text-slate-400">
              {dataset?.document_count} documentos • Ingerido em{" "}
              {dataset?.created_at && new Date(dataset.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dataset?.status === "COMPLETED" && (
            <>
              <button
                onClick={() => setShowConfigModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-800 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Reconfigurar Parâmetros</span>
              </button>
              <a
                href={api.getExportUrl(datasetId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Visão de Processamento em Andamento (Pipeline em Execução) */}
      {dataset?.status === "PROCESSING" && (
        <div className="my-12 p-8 max-w-xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>

          <h2 className="text-base font-bold text-white mb-1">Processando Agrupamento Semântico</h2>
          <p className="text-xs text-slate-400 mb-6">
            O pipeline está computando vetores densos, projetando vizinhanças via UMAP e sintetizando tópicos.
          </p>

          {/* Barra de Progresso */}
          <div className="w-full bg-slate-800 rounded-full h-2.5 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress?.progress_percent || 15}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-6">
            <span>{progress?.progress_message || "Executando etapas..."}</span>
            <span className="font-bold text-indigo-400">{progress?.progress_percent || 15}%</span>
          </div>

          {/* Etapas do Pipeline */}
          <div className="grid grid-cols-5 gap-1.5 text-[9px] font-mono text-slate-500 border-t border-slate-800/80 pt-4">
            <div className={progress && progress.progress_percent >= 10 ? "text-indigo-400 font-semibold" : ""}>
              1. Ingestão
            </div>
            <div className={progress && progress.progress_percent >= 30 ? "text-indigo-400 font-semibold" : ""}>
              2. Embeddings
            </div>
            <div className={progress && progress.progress_percent >= 55 ? "text-indigo-400 font-semibold" : ""}>
              3. UMAP
            </div>
            <div className={progress && progress.progress_percent >= 70 ? "text-indigo-400 font-semibold" : ""}>
              4. HDBSCAN
            </div>
            <div className={progress && progress.progress_percent >= 85 ? "text-indigo-400 font-semibold" : ""}>
              5. LLM
            </div>
          </div>
        </div>
      )}

      {/* Visão de Uploaded (Aguardando Disparo) */}
      {dataset?.status === "UPLOADED" && (
        <div className="my-12 p-8 max-w-lg mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl text-center">
          <FileSpreadsheet className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white mb-1">Dataset Pronto para Análise</h2>
          <p className="text-xs text-slate-400 mb-6">
            Foram identificados {dataset.document_count} documentos nesta base. Clique abaixo para iniciar o agrupamento.
          </p>
          <button
            onClick={handleTriggerAnalysis}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Executar Agrupamento UMAP + HDBSCAN</span>
          </button>
        </div>
      )}

      {/* Visão de Falha */}
      {dataset?.status === "FAILED" && (
        <div className="my-12 p-8 max-w-lg mx-auto bg-slate-900/80 border border-rose-500/20 rounded-2xl shadow-2xl text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white mb-1">Falha na Execução do Agrupamento</h2>
          <p className="text-xs text-rose-300 mb-6">{dataset.error_message || error}</p>
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente com Novos Parâmetros</span>
          </button>
        </div>
      )}

      {/* Visão Principal Concluída: Dashboard com Mapa 2D + Lista de Tópicos */}
      {dataset?.status === "COMPLETED" && results && (
        <div className="space-y-6">
          {/* Barra de Estatísticas do Agrupamento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Total de Textos</span>
              <span className="text-xl font-bold text-white font-mono">{results.total_documents}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Textos Agrupados</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">
                {results.clustered_documents}
                <span className="text-[11px] text-slate-500 font-sans ml-1">
                  ({Math.round((results.clustered_documents / (results.total_documents || 1)) * 100)}%)
                </span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Ruído / Disperso (-1)</span>
              <span className="text-xl font-bold text-slate-400 font-mono">
                {results.noise_documents}
                <span className="text-[11px] text-slate-500 font-sans ml-1">
                  ({Math.round((results.noise_documents / (results.total_documents || 1)) * 100)}%)
                </span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Tópicos Descobertos</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">
                {results.topics.filter((t) => t.cluster_label !== -1).length}
              </span>
            </div>
          </div>

          {/* Grid Principal: Scatter Plot 2D (Esquerda) e Lista de Tópicos (Direita) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <ClusterScatterPlot
                points={results.scatter_points}
                onSelectPoint={handleSelectPoint}
                selectedCluster={selectedCluster}
                selectedPointId={selectedPointId}
              />
            </div>

            <div className="lg:col-span-5">
              <TopicCardList
                topics={results.topics}
                selectedCluster={selectedCluster}
                onSelectCluster={setSelectedCluster}
                totalDocuments={results.total_documents}
              />
            </div>
          </div>
        </div>
      )}

      {/* Drawer Lateral de Inspeção do Documento */}
      <DocumentInspector document={inspectedDoc} onClose={() => setInspectedDoc(null)} />

      {/* Modal de Re-parametrização */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Reconfigurar Hiperparâmetros
            </h3>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Min Cluster Size (HDBSCAN)</span>
                <span className="font-mono text-indigo-400 font-bold">{reanalyzeParams.min_cluster_size}</span>
              </div>
              <input
                type="range"
                min={3}
                max={50}
                value={reanalyzeParams.min_cluster_size}
                onChange={(e) =>
                  setReanalyzeParams({ ...reanalyzeParams, min_cluster_size: parseInt(e.target.value) || 5 })
                }
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Min Samples</span>
                <span className="font-mono text-indigo-400 font-bold">{reanalyzeParams.min_samples}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={reanalyzeParams.min_samples}
                onChange={(e) =>
                  setReanalyzeParams({ ...reanalyzeParams, min_samples: parseInt(e.target.value) || 2 })
                }
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Modelo de Síntese LLM</label>
              <select
                value={reanalyzeParams.llm_model}
                onChange={(e) => setReanalyzeParams({ ...reanalyzeParams, llm_model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                <option value="ollama/llama3">ollama/llama3 (Local)</option>
                <option value="heuristic">Heurístico / Local</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleTriggerAnalysis}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Re-executar Análise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

