export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  created_at?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  contingency_percentage: number;
  impoconsumo_percentage: number;
  recipe_type?: 'base' | 'main'; // 'base' para subrecetas, 'main' para platos finales
  created_at?: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  created_at?: string;
  ingredient?: Ingredient;
}