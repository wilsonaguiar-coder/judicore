"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, X, File as FileIcon, FileText, Info, AlertCircle } from "lucide-react";

import { useAuthStore } from "@/store/auth";

interface PieceCreationFormProps {
  title: string;
  description: string;
  auxiliaryText: string;
}

interface AttachedFile {
  id: string;
  file: File;
  category: string;
}

const CATEGORIES = [
  "Documento principal",
  "Documento pessoal",
  "Peça da parte contrária",
  "Prova",
  "Decisão judicial",
  "Documento administrativo",
  "Cálculo",
  "Outros",
];

export function PieceCreationForm({ title, description, auxiliaryText }: PieceCreationFormProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [orientation, setOrientation] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showBlockToast, setShowBlockToast] = useState(false);

  const quotaUsed = user?.piecesUsedCurrentCycle ?? 23;
  const quotaTotal = user?.monthlyPieceLimit ?? 50;
  const isBlocked = quotaUsed >= quotaTotal;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        category: "Outros",
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateCategory = (id: string, category: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleGenerate = () => {
    if (isBlocked) {
      setShowBlockToast(true);
      setTimeout(() => setShowBlockToast(false), 5000);
      return;
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <div className="flex flex-col flex-1 h-full max-w-4xl mx-auto w-full pb-20 relative">
      {/* Toast de Geração */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
          <Info size={18} className="text-violet-400" />
          <p className="text-sm font-medium">A geração assistida por IA será disponibilizada na próxima etapa do MVP.</p>
        </div>
      )}

      {/* Toast de Bloqueio por Cota */}
      {showBlockToast && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
          <AlertCircle size={18} className="text-white" />
          <p className="text-sm font-medium">Você atingiu o limite de peças do seu plano neste ciclo. Aguarde a renovação ou realize upgrade de assinatura.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8 mt-4">
        <div>
          <button
            onClick={() => router.push("/dashboard/pieces")}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft size={16} /> Voltar para Peças Jurídicas
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600/10 text-violet-600 flex items-center justify-center rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Bloco 1: Documentos */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Documentos</h2>
          <p className="text-sm text-slate-600 mb-4">Anexe os documentos que a IA deverá considerar na elaboração da peça.</p>
          
          <div className="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded border border-blue-100 mb-5">
            {auxiliaryText}
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <UploadCloud size={32} className="text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">Clique para enviar arquivos</p>
            <p className="text-xs text-slate-500">PDF, DOC, DOCX, DOT, TXT, JPG, PNG, WEBP</p>
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.dot,.txt,.jpg,.jpeg,.png,.webp"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-700">Arquivos anexados ({files.length})</h3>
              {files.map((fileObj) => (
                <div key={fileObj.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileIcon size={20} className="text-slate-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-700 truncate">{fileObj.file.name}</p>
                      <p className="text-xs text-slate-500">{formatSize(fileObj.file.size)} • {fileObj.file.type || 'Desconhecido'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <select
                      value={fileObj.category}
                      onChange={(e) => updateCategory(fileObj.id, e.target.value)}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bloco 2: Orientação */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Direcionamento para a IA</h2>
          <p className="text-sm text-slate-600 mb-4">Descreva o objetivo da peça, os pontos que devem ser defendidos e qualquer orientação estratégica relevante.</p>
          
          <textarea
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            placeholder="Ex.: Contrarrazoar destacando que não há controvérsia sobre o tempo de serviço suficiente do autor para aposentadoria, impugnando apenas a tentativa da parte contrária de rediscutir matéria já reconhecida."
            className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </section>

        {/* Bloco 3: Info & Submit */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800 leading-relaxed">
              A IA analisará os documentos anexados, identificará dados relevantes, extrairá informações úteis e elaborará um rascunho inicial da peça. O usuário será responsável por revisar, alterar e aprovar o conteúdo antes do uso.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerate}
            className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm"
          >
            Gerar rascunho da peça
          </button>
        </div>

      </div>
    </div>
  );
}
