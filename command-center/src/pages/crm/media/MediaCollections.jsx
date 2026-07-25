import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

export default function MediaCollections() {
  const { caps } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('mil_collections')
      .select('*, mil_collection_items(count)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });
    if (err) setError(err.message);
    else setRows(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!caps.isReviewer) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from('mil_collections')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        owner_user_id: auth?.user?.id,
        visibility: 'internal',
      })
      .select('*')
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setTitle('');
    setDescription('');
    await load();
  };

  return (
    <div className="space-y-5 max-w-3xl" data-testid="media-collections">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Collections</h2>
        <p className="text-sm text-slate-600">Flexible sets for website launch, training, GBP, and creator assignments.</p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {caps.isReviewer && (
        <form onSubmit={create} className="rounded-xl border bg-white p-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Title</span>
            <input required className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Description</span>
            <textarea className="mt-1 w-full rounded-md border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button type="submit" className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px]">Create collection</button>
        </form>
      )}
      <ul className="space-y-2">
        {rows.length === 0 && (
          <li className="rounded-xl border bg-white p-6 text-sm text-slate-600">No collections yet.</li>
        )}
        {rows.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4">
            <div className="font-medium text-slate-900">{c.title}</div>
            <div className="text-sm text-slate-600 mt-1">{c.description || 'No description'}</div>
            <div className="text-xs text-slate-500 mt-2">Visibility: {c.visibility}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
