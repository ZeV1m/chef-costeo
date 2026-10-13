'use client';

import IngredientsManager from './ingredients';
import RecipesManager from './recipes';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="mb-4">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Chef Costeo 🍳
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestión de insumos, control de costos y escandallo de recetas.
          </p>
        </header>

        {/* Módulo de Gestión de Insumos */}
        <IngredientsManager />

        {/* Módulo de Creación de Recetas */}
        <RecipesManager />
      </div>
    </main>
  );
}