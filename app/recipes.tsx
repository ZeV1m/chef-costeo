'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Ingredient, Recipe } from './types';

interface RecipeWithDetails extends Recipe {
  recipe_type?: 'base' | 'main';
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
  const [recipeType, setRecipeType] = useState<'base' | 'main'>('base');
  const [contingency, setContingency] = useState(5.00);
  const [impoconsumo, setImpoconsumo] = useState(8.00);
  const [desiredCostPercentage, setDesiredCostPercentage] = useState<string>('30'); // Porcentaje de costo deseado para el PPV
  
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string; quantity: number }[]>([]);
  const [currentIngredientId, setCurrentIngredientId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

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

  const handleStartEditRecipe = (recipe: RecipeWithDetails) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setDescription(recipe.description || '');
    setServings(recipe.servings.toString());
    setRecipeType(recipe.recipe_type || 'base');
    setContingency(recipe.contingency_percentage);
    setImpoconsumo(recipe.impoconsumo_percentage);
    setSelectedIngredients(
      recipe.items.map((item) => ({
        ingredient_id: item.ingredient.id,
        quantity: item.quantity,
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingRecipeId(null);
    setRecipeName('');
    setDescription('');
    setServings('1');
    setRecipeType('base');
    setContingency(5.00);
    setImpoconsumo(8.00);
    setSelectedIngredients([]);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName || selectedIngredients.length === 0) return;

    setLoading(true);
    setErrorMessage('');

    const rawCost = selectedIngredients.reduce((acc, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredient_id);
      return acc + (ing?.cost_per_unit || 0) * item.quantity;
    }, 0);

    const contingencyCost = rawCost * (contingency / 100);
    const subtotalWithContingency = rawCost + contingencyCost;
    const effectiveImpoconsumo = recipeType === 'base' ? 0 : impoconsumo;
    const impoconsumoCost = subtotalWithContingency * (effectiveImpoconsumo / 100);
    const totalCost = subtotalWithContingency + impoconsumoCost;
    const parsedServings = Number(servings) || 1;
    const costPerServing = parsedServings > 0 ? totalCost / parsedServings : totalCost;

    if (editingRecipeId) {
      const { error: updateError } = await supabase
        .from('recipes')
        .update({
          name: recipeName,
          description,
          servings: parsedServings,
          contingency_percentage: Number(contingency),
          impoconsumo_percentage: Number(effectiveImpoconsumo),
          recipe_type: recipeType,
        })
        .eq('id', editingRecipeId);

      if (updateError) {
        setErrorMessage(`Error al actualizar la receta: ${updateError.message}`);
        setLoading(false);
        return;
      }

      await supabase.from('recipe_ingredients').delete().eq('recipe_id', editingRecipeId);
      const recipeItems = selectedIngredients.map((item) => ({
        recipe_id: editingRecipeId,
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
      }));
      await supabase.from('recipe_ingredients').insert(recipeItems);

      setEditingRecipeId(null);
    } else {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .insert([
          {
            name: recipeName,
            description,
            servings: parsedServings,
            contingency_percentage: Number(contingency),
            impoconsumo_percentage: Number(effectiveImpoconsumo),
            recipe_type: recipeType,
          },
        ])
        .select()
        .single();

      if (recipeError || !recipeData) {
        setErrorMessage(`Error al guardar la receta: ${recipeError?.message || 'Desconocido'}`);
        setLoading(false);
        return;
      }

      const recipeItems = selectedIngredients.map((item) => ({
        recipe_id: recipeData.id,
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
      }));

      await supabase.from('recipe_ingredients').insert(recipeItems);

      const prefixName = recipeType === 'base' ? '[Base]' : '[Principal]';
      await supabase.from('ingredients').insert([
        {
          name: `${prefixName} ${recipeName}`,
          unit: 'porción',
          cost_per_unit: costPerServing,
        },
      ]);
    }

    setRecipeName('');
    setDescription('');
    setServings('1');
    setRecipeType('base');
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
      {/* Formulario de Creación / Edición */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {editingRecipeId ? 'Editar Receta' : 'Crear Nueva Receta'}
          </h2>
          {editingRecipeId && (
            <button
              onClick={handleCancelEdit}
              className="text-sm text-amber-600 hover:text-amber-800 underline font-semibold"
            >
              Cancelar Edición
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSaveRecipe} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Clasificación</label>
              <select
                value={recipeType}
                onChange={(e) => setRecipeType(e.target.value as 'base' | 'main')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium bg-white"
              >
                <option value="base">Receta Base / Subreceta</option>
                <option value="main">Receta Principal / Plato</option>
              </select>
            </div>

            <div className="md:col-span-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Porciones</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <input
                type="text"
                placeholder="Notas..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-950 placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impoconsumo (%) {recipeType === 'base' && <span className="text-xs text-gray-400 italic">(No aplica para Bases)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                value={recipeType === 'base' ? 0 : impoconsumo}
                disabled={recipeType === 'base'}
                onChange={(e) => setImpoconsumo(Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium ${recipeType === 'base' ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'text-gray-950'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">% Costo Deseado (para PPV)</label>
              <input
                type="number"
                step="0.1"
                value={desiredCostPercentage}
                onChange={(e) => setDesiredCostPercentage(e.target.value)}
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
            className={`w-full text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 ${editingRecipeId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Guardando...' : editingRecipeId ? 'Actualizar Receta' : 'Guardar Receta y Registrar en Inventario'}
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

              const isBase = recipe.recipe_type === 'base';
              const parsedDesiredPct = parseFloat(desiredCostPercentage) || 30;
              // Cálculo del Precio de Venta (PPV) por regla de tres (Costo Porción / % deseado * 100)
              const suggestedPPV = parsedDesiredPct > 0 ? costPerServing / (parsedDesiredPct / 100) : 0;

              return (
                <div key={recipe.id} id={`recipe-card-${recipe.id}`} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 shadow-sm">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{recipe.name}</h3>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${isBase ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {isBase ? 'Base' : 'Principal'}
                          </span>
                        </div>
                        {recipe.description && <p className="text-sm text-gray-600">{recipe.description}</p>}
                      </div>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-3 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                        Porciones: {recipe.servings}
                      </span>
                      <button
                        onClick={() => handleStartEditRecipe(recipe)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
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

                  <div className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
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
                    <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                      <p className="text-xs text-emerald-700 uppercase font-extrabold">Costo por Porción</p>
                      <p className="text-lg font-extrabold text-emerald-800">${costPerServing.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-purple-50 p-2 rounded border border-purple-200">
                      <p className="text-xs text-purple-700 uppercase font-extrabold">PPV ({desiredCostPercentage}%)</p>
                      <p className="text-lg font-extrabold text-purple-800">${suggestedPPV.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
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