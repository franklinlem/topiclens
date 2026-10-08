"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, DatasetUploadPreview, ClusteringParameters } from "@/lib/api-client";
import {
  UploadCloud,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info
} from "lucide-react";

export default function NewDatasetPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTextCol, setSelectedTextCol] = useState("");

  const [preview, setPreview] = useState<DatasetUploadPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hiperparâmetros do UMAP e HDBSCAN
  const [params, setParams] = useState<ClusteringParameters>({
    min_cluster_size: 15,
    min_samples: 5,
    n_neighbors_umap: 15,
    umap_components: 5,
    llm_model: "gpt-4o-mini",
  });

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    if (!datasetName) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, ""));
    }

    try {
      setPreviewLoading(true);
      const prevData = await api.previewFile(file);
      setPreview(prevData);
      setSelectedTextCol(prevData.suggested_text_column);
    } catch (err: any) {
      setError(err.message || "Falha ao pré-visualizar arquivo");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Botão de carregar dados de demonstração
  const handleLoadDemo = async () => {
    try {
      setPreviewLoading(true);
      setError(null);
      const res = await fetch("/customer_feedback.csv");
      let blob: Blob;
      if (res.ok) {
        blob = await res.blob();
      } else {
        // Fallback: busca via API ou cria CSV sintético de demonstração
        const csvText = `id,customer_name,feedback,rating,channel
1,Lucas Silva,"Ao tentar finalizar o pagamento no cartão de crédito o app dá erro 500 e fecha sozinho.",1,app_review
2,Mariana Souza,"Meu pagamento via Pix foi debitado da minha conta mas o pedido continua como não pago no sistema.",1,reclame_aqui
3,Rafael Costa,"Sempre que clico em confirmar compra na tela de checkout recebo a mensagem 'Erro inesperado'.",1,zendesk
4,Carlos Eduardo,"Tentei pagar três vezes pelo app e em todas a transação falhou, mas cobrou na fatura.",1,reclame_aqui
5,Fernanda Dias,"Erro ao processar o pagamento com cartão virtual. Não consigo concluir meu pedido.",1,zendesk
6,Thiago Martins,"O aplicativo trava e congela toda vez que tento abrir a lista de produtos.",1,app_review
7,Patricia Gomes,"Muito lento no Android! O app demora mais de 30 segundos para carregar a tela inicial.",1,play_store
8,Rodrigo Ferreira,"Depois do último update o app fecha inesperadamente toda hora que abro a câmera para escanear.",1,play_store
9,Aline Carvalho,"A tela fica totalmente preta após fazer login e preciso forçar a parada do aplicativo.",1,app_review
10,Bruno Barbosa,"Consumo de bateria absurdo depois da versão 2.4, meu celular esquenta muito.",2,play_store
11,Felipe Nogueira,"Estou esperando resposta do suporte há mais de 4 dias e ninguém responde meu chamado.",1,zendesk
12,Carolina Mendes,"O chatbot de suporte é péssimo, fica em círculos e não transfere para um atendente humano.",1,intercom
13,Diego Castro,"Péssimo atendimento ao cliente. Prometeram estorno em 24h e já faz duas semanas.",1,reclame_aqui
14,Natalia Pinto,"Abri três tickets no suporte sobre meu pacote extraviado e fecharam sem resolver.",1,zendesk
15,Marcelo Cavalcanti,"Suporte telefônico nunca atende e o chat online sempre dá erro de conexão.",1,reclame_aqui
16,Pedro Henrique,"Aplicativo sensacional! Interface muito limpa, intuitiva e fácil de navegar.",5,app_store
17,Isabela Borges,"Adorei a nova experiência de usuário. Muito mais ágil e agradável aos olhos.",5,app_store
18,Renan Pacheco,"O design ficou incrível e o fluxo de busca é extremamente rápido. Parabéns à equipe!",5,play_store
19,Luana Vasconcelos,"Melhor app da categoria! Uso todos os dias e nunca tive nenhum problema.",5,app_store
20,Vitor Azevedo,"Experiência impecável do início ao fim. Interface moderna e navegação suave.",5,play_store
21,Marcio Silva,"Ok.",3,app_review
22,Kelly Santos,"teste 123",3,app_review`;
        blob = new Blob([csvText], { type: "text/csv" });
      }
      const demoFile = new File([blob], "customer_feedback_demo.csv", { type: "text/csv" });
      setDatasetName("Customer Feedback (Demonstração)");
      setDescription("Base de avaliações de clientes cobrindo checkout, bugs, suporte e usabilidade.");
      // Ajusta parâmetros adequados para dataset demo
      setParams((p) => ({ ...p, min_cluster_size: 4, min_samples: 2, n_neighbors_umap: 5 }));
      await handleFileChange(demoFile);
    } catch (err: any) {
      setError("Erro ao carregar dados de demonstração: " + err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Por favor, selecione um arquivo CSV ou JSON.");
      return;
    }
    if (!datasetName.trim()) {
      setError("Informe o nome do dataset.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Upload do Dataset
      const createdDataset = await api.uploadDataset(
        selectedFile,
        datasetName,
        description,
        selectedTextCol
      );

      // 2. Dispara Análise
      await api.startAnalysis(createdDataset.id, params);

      // 3. Redireciona para a página de análise em tempo real
      router.push(`/analysis/${createdDataset.id}`);
    } catch (err: any) {
      setError(err.message || "Erro no processamento do dataset");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Ingestão de Base Textual</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Carregue um arquivo CSV contendo os textos a serem categorizados e configure os parâmetros de agrupamento.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco de Upload */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              1. Selecionar Arquivo de Dados
            </h2>
            <button
              type="button"
              onClick={handleLoadDemo}
              className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              Carregar Amostra de Demonstração
            </button>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              selectedFile
                ? "border-indigo-500/60 bg-indigo-950/10"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">{selectedFile.name}</span>
                <span className="text-xs text-slate-400 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
                <span className="text-[11px] text-indigo-400 mt-1">Clique para substituir o arquivo</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-10 h-10 text-slate-500" />
                <span className="text-sm font-medium text-slate-300">
                  Arraste e solte o arquivo CSV ou clique para selecionar
                </span>
                <span className="text-xs text-slate-500">Formatos suportados: .csv, .json</span>
              </div>
            )}
          </div>

          {/* Pré-visualização e seleção de coluna */}
          {previewLoading && (
            <div className="mt-4 p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              Analisando colunas e linhas do arquivo...
            </div>
          )}

          {preview && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  {preview.total_rows} linhas detectadas • Selecione a coluna com o texto principal:
                </span>
                <select
                  value={selectedTextCol}
                  onChange={(e) => setSelectedTextCol(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {preview.columns.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === preview.suggested_text_column ? "(Sugerida)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tabela de Amostra */}
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                      {preview.columns.map((col) => (
                        <th
                          key={col}
                          className={`p-2 font-mono ${
                            col === selectedTextCol ? "text-indigo-400 bg-indigo-950/30 font-bold" : ""
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {preview.sample_rows.map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map((col) => (
                          <td
                            key={col}
                            className={`p-2 max-w-[200px] truncate ${
                              col === selectedTextCol ? "bg-indigo-950/10 font-medium" : ""
                            }`}
                          >
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Metadados do Dataset */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>2. Metadados do Projeto</span>
          </h2>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Nome do Dataset</label>
            <input
              type="text"
              required
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Ex: Customer Feedback Q3 2026"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Descrição (Opcional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Avaliações coletadas na App Store e Play Store sobre a versão 2.4..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Configuração de Parâmetros de Agrupamento */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              3. Parâmetros de Agrupamento Semântico
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">UMAP + HDBSCAN + LiteLLM</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Min Cluster Size (HDBSCAN)</span>
                <span className="font-mono text-indigo-400 font-bold">{params.min_cluster_size}</span>
              </div>
              <input
                type="range"
                min={3}
                max={50}
                value={params.min_cluster_size}
                onChange={(e) =>
                  setParams({ ...params, min_cluster_size: parseInt(e.target.value) || 5 })
                }
                className="w-full accent-indigo-500"
              />
              <span className="text-[10px] text-slate-500 block">
                Mínimo de documentos para consolidar um grupo
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Min Samples (Conservadorismo)</span>
                <span className="font-mono text-indigo-400 font-bold">{params.min_samples}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={params.min_samples}
                onChange={(e) =>
                  setParams({ ...params, min_samples: parseInt(e.target.value) || 2 })
                }
                className="w-full accent-indigo-500"
              />
              <span className="text-[10px] text-slate-500 block">
                Valores maiores isolam mais ruído disperso (-1)
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Nº de Vizinhos UMAP</span>
                <span className="font-mono text-indigo-400 font-bold">{params.n_neighbors_umap}</span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                value={params.n_neighbors_umap}
                onChange={(e) =>
                  setParams({ ...params, n_neighbors_umap: parseInt(e.target.value) || 5 })
                }
                className="w-full accent-indigo-500"
              />
              <span className="text-[10px] text-slate-500 block">
                Equilíbrio entre estrutura local e global
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Modelo de Síntese LLM</label>
              <select
                value={params.llm_model}
                onChange={(e) => setParams({ ...params, llm_model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Recomendado)</option>
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                <option value="ollama/llama3">ollama/llama3 (Local)</option>
                <option value="heuristic">Heurístico / Local (Sem Chave de API)</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">
                Gera títulos e resumos executivos a partir dos exemplares
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedFile}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando e Inicializando...</span>
              </>
            ) : (
              <>
                <span>Enviar e Iniciar Agrupamento</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

