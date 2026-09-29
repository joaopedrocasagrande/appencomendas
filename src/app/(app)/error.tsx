"use client";

import { useEffect } from "react";
import { btnPrimary } from "@/components/ui";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Algo deu errado</h2>
      <p className="mt-2 text-sm text-slate-600">
        Não foi possível concluir a ação. Verifique sua conexão e tente novamente. Se continuar, avise com um print
        desta tela.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Código: {error.digest}</p>}
      <button className={`${btnPrimary} mt-4`} onClick={() => retry()}>
        Tentar novamente
      </button>
    </div>
  );
}
