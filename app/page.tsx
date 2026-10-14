'use client';

import { useState } from 'react';
import IngredientsManager from './ingredients';
import RecipesManager from './recipes';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes'>('ingredients');

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50/60 via-gray-50 to-purple-50/40 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="mb-4">
          <h1 className="text-3xl font-extrabold text-purple-950 tracking-tight flex items-center gap-2">
            Chef Costeo 🍳
          </h1>
          <p className="text-sm text-purple-700/80 mt-1">
            Gestión de insumos, control de costos y escandallo de recetas.
          </p>
        </header>

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-purple-200">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'ingredients'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            Gestión de Insumos
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'recipes'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            Gestión de Recetas
          </button>
        </div>

        {/* Contenido según la pestaña activa */}
        <div>
          {activeTab === 'ingredients' && <IngredientsManager />}
          {activeTab === 'recipes' && <RecipesManager />}
        </div>
      </div>
    </main>
  );
}