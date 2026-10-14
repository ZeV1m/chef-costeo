'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Ingredient, Recipe } from './types';

interface RecipeWithDetails extends Recipe {
  items: {
    id: string;
    quantity: number;
    ingredient: Ingredient;
  }[];
}

export default function RecipesManager() {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  
  const [recipeName, setRecipeName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState<string>('1');
  const [contingency, setContingency] = useState(5.00);
  const [impoconsumo, setImpoconsumo] = useState(8.00);
  
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string; quantity: number }[]>([]);
  const [currentIngredientId, setCurrentIngredientId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: ingData } = await supabase.from('ingredients').select('*').order('name');
      if (ingData) setIngredients(ingData);

      const { data: recData, error: recError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients (
            id,
            quantity,
            ingredients (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (recError) {
        console.error('Error al cargar recetas:', recError.message);
        return;
      }

      if (recData) {
        const formattedRecipes: RecipeWithDetails[] = recData.map((rec: any) => ({
          ...rec,
          items: (rec.recipe_ingredients || []).map((ri: any) => ({
            id: ri.id,
            quantity: ri.quantity,
            ingredient: ri.ingredients,
          })),
        }));
        setRecipes(formattedRecipes);
      }
    } catch (err) {
      console.error('Excepción en fetchData:', err);
    }
  };

  const handleAddIngredientToRecipe = () => {
    if (!currentIngredientId || !currentQuantity || parseFloat(currentQuantity) <= 0) return;
    
    setSelectedIngredients([
      ...selectedIngredients,
      { ingredient_id: currentIngredientId, quantity: parseFloat(currentQuantity) }
    ]);

    setCurrentIngredientId('');
    setCurrentQuantity('');
  };

  const handleRemoveIngredient = (index: number) => {
    setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index));
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName || selectedIngredients.length === 0) return;

    setLoading(true);
    setErrorMessage('');

    // Calcular el costo total preliminar para la sub-receta / receta
    const rawCost = selectedIngredients.reduce((acc, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredient_id);
      return acc + (ing?.cost_per_unit || 0) * item.quantity;
    }, 0);

    const contingencyCost = rawCost * (contingency / 100);
    const subtotalWithContingency = rawCost + contingencyCost;
    const impoconsumoCost = subtotalWithContingency * (impoconsumo / 100);
    const totalCost = subtotalWithContingency + impoconsumoCost;
    const parsedServings = Number(servings) || 1;
    const costPerServing = parsedServings > 0 ? totalCost / parsedServings : totalCost;

    // 1. Insertar Receta Principal
    const { data: recipeData, error: recipeError } = await supabase
      .from('recipes')
      .insert([
        {
          name: recipeName,
          description,
          servings: parsedServings,
          contingency_percentage: Number(contingency),
          impoconsumo_percentage: Number(impoconsumo),
        },
      ])
      .select()
      .single();

    if (recipeError || !recipeData) {
      console.error('Error insertando receta:', recipeError);
      setErrorMessage(`Error al guardar la receta: ${recipeError?.message || 'Desconocido'}`);
      setLoading(false);
      return;
    }

    // 2. Insertar Detalle de Insumos Relacionados
    const recipeItems = selectedIngredients.map((item) => ({
      recipe_id: recipeData.id,
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase.from('recipe_ingredients').insert(recipeItems);

    if (itemsError) {
      console.error('Error insertando ingredientes de la receta:', itemsError);
      setErrorMessage(`Error al guardar los insumos de la receta: ${itemsError.message}`);
      setLoading(false);
      return;
    }

    // 3. Sincronizar automáticamente la receta como un Insumo (para que actúe como Sub-receta)[cite: 7, 8]
    const { error: ingredientSyncError } = await supabase.from('ingredients').insert([
      {
        name: `[Base] ${recipeName}`,
        unit: 'porción',
        cost_per_unit: costPerServing,
      },
    ]);

    if (ingredientSyncError) {
      console.warn('Advertencia al sincronizar receta como insumo:', ingredientSyncError.message);
    }

    // Limpiar formulario y refrescar datos
    setRecipeName('');
    setDescription('');
    setServings('1');
    setSelectedIngredients([]);
    await fetchData();
    setLoading(false);
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta receta?')) return;

    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);

    if (!error) {
      fetchData();
    }
  };

  const handleExportPDF = (recipeId: string) => {
    const printElement = document.getElementById(`recipe-card-${recipeId}`);
    if (!printElement) return;

    const originalContents = document.body.innerHTML;
    const printContents = printElement.innerHTML;

    document.body.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
        <h1 style="color: #2563eb; margin-bottom: 5px;">Chef Costeo 🍳 - Reporte de Receta</h1>
        <hr style="border: 1px solid #ccc; margin-bottom: 20px;" />
        ${printContents}
      </div>
    `;

    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      {/* Formulario de Creación */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Crear Nueva Receta / Base</h2>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleCreateRecipe} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Receta</label>
              <input
                type="text"
                placeholder="Ej: Ganache Básica"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porciones / Porción base</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <input
                type="text"
                placeholder="Notas de preparación..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen de Contingencia (%)</label>
              <input
                type="number"
                step="0.01"
                value={contingency}
                onChange={(e) => setContingency(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impoconsumo (%)</label>
              <input
                type="number"
                step="0.01"
                value={impoconsumo}
                onChange={(e) => setImpoconsumo(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-md font-semibold text-gray-700 mb-3">Agregar Insumos o Bases</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <select
                  value={currentIngredientId}
                  onChange={(e) => setCurrentIngredientId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
                >
                  <option value="">-- Selecciona un Insumo o Base --</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (${ing.cost_per_unit} / {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Cantidad"
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddIngredientToRecipe}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  + Añadir a la lista
                </button>
              </div>
            </div>

            {selectedIngredients.length > 0 && (
              <div className="mb-4">
                <table className="w-full text-left border-collapse border rounded-lg">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-sm text-gray-600">Insumo / Base</th>
                      <th className="p-2 text-sm text-gray-600">Cantidad</th>
                      <th className="p-2 text-sm text-gray-600">Subtotal</th>
                      <th className="p-2 text-sm text-gray-600 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIngredients.map((item, index) => {
                      const ing = ingredients.find((i) => i.id === item.ingredient_id);
                      const subtotal = ing ? ing.cost_per_unit * item.quantity : 0;
                      return (
                        <tr key={index} className="border-b">
                          <td className="p-2 text-sm text-gray-800">{ing?.name}</td>
                          <td className="p-2 text-sm text-gray-800">{item.quantity} {ing?.unit}</td>
                          <td className="p-2 text-sm font-semibold text-gray-900">${subtotal.toLocaleString('es-CO')}</td>
                          <td className="p-2 text-sm text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(index)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold"
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || selectedIngredients.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Guardando Receta...' : 'Guardar Receta y Registrar como Base'}
          </button>
        </form>
      </div>

      {/* Listado y Escandallo de Recetas Guardadas */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Recetas Guardadas y Escandallo</h2>

        {recipes.length === 0 ? (
          <p className="text-gray-500 italic text-center py-4">No hay recetas registradas todavía.</p>
        ) : (
          <div className="space-y-6">
            {recipes.map((recipe) => {
              const rawCost = recipe.items.reduce((acc, item) => {
                return acc + (item.ingredient?.cost_per_unit || 0) * item.quantity;
              }, 0);

              const contingencyCost = rawCost * ((recipe.contingency_percentage || 0) / 100);
              const subtotalWithContingency = rawCost + contingencyCost;
              const impoconsumoCost = subtotalWithContingency * ((recipe.impoconsumo_percentage || 0) / 100);
              const totalCost = subtotalWithContingency + impoconsumoCost;
              const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : totalCost;

              return (
                <div key={recipe.id} id={`recipe-card-${recipe.id}`} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 shadow-sm">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 border-b pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{recipe.name}</h3>
                      {recipe.description && <p className="text-sm text-gray-600">{recipe.description}</p>}
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-3 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                        Porciones: {recipe.servings}
                      </span>
                      <button
                        onClick={() => handleExportPDF(recipe.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🖨️ Exportar PDF
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        className="text-red-600 hover:text-red-800 font-semibold text-xs border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="pb-2">Insumo / Base</th>
                          <th className="pb-2">Cantidad</th>
                          <th className="pb-2">Costo Unitario</th>
                          <th className="pb-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.items.map((item) => {
                          const unitCost = item.ingredient?.cost_per_unit || 0;
                          const sub = unitCost * item.quantity;
                          return (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="py-2 text-gray-800 font-medium">{item.ingredient?.name}</td>
                              <td className="py-2 text-gray-600">{item.quantity} {item.ingredient?.unit}</td>
                              <td className="py-2 text-gray-600">${unitCost.toLocaleString('es-CO')}</td>
                              <td className="py-2 text-right font-semibold text-gray-900">${sub.toLocaleString('es-CO')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Costo Bruto</p>
                      <p className="text-md font-bold text-gray-800">${rawCost.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Contingencia ({recipe.contingency_percentage}%)</p>
                      <p className="text-md font-bold text-gray-800">${contingencyCost.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Impoconsumo ({recipe.impoconsumo_percentage}%)</p>
                      <p className="text-md font-bold text-gray-800">${impoconsumoCost.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Costo Total</p>
                      <p className="text-md font-extrabold text-blue-600">${totalCost.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1 bg-emerald-50 p-2 rounded border border-emerald-200">
                      <p className="text-xs text-emerald-700 uppercase font-extrabold">Costo por Porción</p>
                      <p className="text-lg font-extrabold text-emerald-800">${costPerServing.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}