import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Reaproveita telas já abertas por alguns segundos ao voltar para elas.
    // Ações que alteram dados (salvar, excluir...) limpam esse cache na hora.
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default nextConfig;
