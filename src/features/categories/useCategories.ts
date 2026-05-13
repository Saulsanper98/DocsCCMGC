import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import type { Category } from '@/shared/types';
import toast from 'react-hot-toast';

function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  map.forEach((cat) => {
    if (cat.parent_id) {
      const parent = map.get(cat.parent_id);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(cat);
      }
    } else {
      roots.push(cat);
    }
  });

  function sortSiblings(nodes: Category[]) {
    nodes.sort((a, b) => {
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children?.length) sortSiblings(n.children);
    }
  }

  sortSiblings(roots);
  return roots;
}

export function useCategories() {
  const { categories, setCategories } = useAppStore();
  const [loading, setLoading] = useState(categories.length === 0);
  const [tree, setTree] = useState<Category[]>([]);

  useEffect(() => {
    if (categories.length > 0) {
      setTree(buildTree(categories));
    }
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*, document_count:documents(count)')
        .order('order_index');
      if (error) throw error;
      const cats = (data ?? []).map((c) => ({
        ...c,
        document_count: (c.document_count as Array<{ count: number }>)[0]?.count ?? 0,
      })) as Category[];
      setCategories(cats);
      setTree(buildTree(cats));
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createCategory(name: string, parentId?: string, icon = 'folder', color = '#3B82F6') {
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, slug, parent_id: parentId ?? null, icon, color })
        .select()
        .single();
      if (error) throw error;
      await fetchCategories();
      toast.success('Categoría creada');
      return data as Category;
    } catch {
      toast.error('Error al crear la categoría');
      return null;
    }
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    try {
      const { error } = await supabase.from('categories').update(updates).eq('id', id);
      if (error) throw error;
      await fetchCategories();
      toast.success('Categoría actualizada');
    } catch {
      toast.error('Error al actualizar la categoría');
    }
  }

  async function deleteCategory(id: string) {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      await fetchCategories();
      toast.success('Categoría eliminada');
    } catch {
      toast.error('Error al eliminar la categoría. ¿Tiene documentos asociados?');
    }
  }

  /** Reordena solo categorías raíz (`parent_id` null), según el orden de ids recibido. */
  async function reorderRootCategories(orderedIds: string[]) {
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('categories')
          .update({ order_index: i })
          .eq('id', orderedIds[i])
          .is('parent_id', null);
        if (error) throw error;
      }
      await fetchCategories();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar el orden de categorías');
    }
  }

  return {
    categories,
    tree,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderRootCategories,
    refetch: fetchCategories,
  };
}
