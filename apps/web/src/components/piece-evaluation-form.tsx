"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface PieceEvaluationFormProps {
  generationId: string;
}

const CATEGORIES = ["UX", "PERFORMANCE", "JURIDICO", "BUG", "SUGESTAO"];

export function PieceEvaluationForm({ generationId }: PieceEvaluationFormProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [category, setCategory] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/piece-evaluation/${generationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, category, feedback }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        alert("Erro ao enviar avaliação.");
      }
    } catch (e) {
      alert("Erro ao enviar avaliação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-6 p-6 bg-slate-800/50 border border-slate-700 rounded-xl text-center animate-in fade-in">
        <h3 className="text-lg font-medium text-white mb-2">Avaliação enviada!</h3>
        <p className="text-slate-400 text-sm">Obrigado por ajudar a melhorar o JudiCore.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 bg-slate-800 border border-slate-700 rounded-xl">
      <h3 className="text-lg font-medium text-white mb-4">Avaliar Geração</h3>
      
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="focus:outline-none transition-colors"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(star)}
          >
            <Star
              size={28}
              className={`${
                (hovered || rating) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-slate-500"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Categoria (Opcional)</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          >
            <option value="">Selecione...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">O que poderia melhorar? (Opcional)</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Deixe seu comentário sobre a peça gerada..."
          className="w-full h-24 p-3 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {isSubmitting ? "Enviando..." : "Enviar Avaliação"}
        </button>
      </div>
    </div>
  );
}
