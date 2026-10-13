'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Ingredient } from './types';

export default function IngredientsManager() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para edición
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setIngredients(data);
    }
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cost) return;

    setLoading(true);

    if (editingId) {
      // Editar insumo existente
      const { error } = await supabase
        .from('ingredients')
        .update({
          name,
          unit,
          cost_per_unit: parseFloat(cost),
        })
        .eq('id', editingId);

      if (!error) {
        setEditingId(null);
        setName('');
        setCost('');
        setUnit('g');
        fetchIngredients();
      }
    } else {
      // Crear nuevo insumo
      const { error } = await supabase.from('ingredients').insert([
        {
          name,
          unit,
          cost_per_unit: parseFloat(cost),
        },
      ]);

      if (!error) {
        setName('');
        setCost('');
        fetchIngredients();
      }
    }

    setLoading(false);
  };

  const handleStartEdit = (item: Ingredient) => {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setCost(item.cost_per_unit.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setCost('');
    setUnit('g');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {editingId ? 'Editar Insumo' : 'Gestión de Insumos'}
        </h2>
        {editingId && (
          <button
            onClick={handleCancelEdit}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancelar Edición
          </button>
        )}
      </div>

      {/* Formulario de Registro / Edición */}
      <form onSubmit={handleSaveIngredient} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Insumo</label>
          <input
            type="text"
            placeholder="Ej: Harina de Trigo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
          >
            <option value="g">Gramos (g)</option>
            <option value="kg">Kilogramos (kg)</option>
            <option value="ml">Mililitros (ml)</option>
            <option value="l">Litros (l)</option>
            <option value="unidad">Unidad</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Costo por Unidad ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder="Ej: 15.50"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
            required
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 ${
              editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {loading ? 'Guardando...' : editingId ? 'Actualizar Insumo' : 'Agregar Insumo'}
          </button>
        </div>
      </form>

      {/* Tabla de Insumos Registrados */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 text-sm font-semibold text-gray-600">Nombre</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Unidad</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Costo / Unidad</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500 italic">
                  No hay insumos registrados aún.
                </td>
              </tr>
            ) : (
              ingredients.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 text-gray-800 font-medium">{item.name}</td>
                  <td className="p-3 text-gray-600">{item.unit}</td>
                  <td className="p-3 text-gray-800 font-semibold">
                    ${item.cost_per_unit.toLocaleString('es-CO')}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}