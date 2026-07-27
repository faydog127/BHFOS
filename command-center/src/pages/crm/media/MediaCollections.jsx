import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  addCollectionItem,
  createCollection,
  listCollectionItems,
  listCollections,
  normalizeMilAssetId,
  removeCollectionItem,
} from '@/lib/mediaIntel/api';

function collectionItemCount(row) {
  const nested = row?.mil_collection_items;
  if (Array.isArray(nested) && nested[0] && typeof nested[0].count === 'number') {
    return nested[0].count;
  }
  return 0;
}

export default function MediaCollections() {
  const { caps } = useOutletContext();
  const canManage = Boolean(caps?.isStaff);
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [itemsByCollection, setItemsByCollection] = useState({});
  const [addAssetId, setAddAssetId] = useState('');
  const [itemsBusy, setItemsBusy] = useState(false);

  const load = async () => {
    try {
      const data = await listCollections();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load collections');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadItems = async (collectionId) => {
    setItemsBusy(true);
    try {
      const items = await listCollectionItems(collectionId);
      setItemsByCollection((prev) => ({ ...prev, [collectionId]: items }));
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load collection items');
    } finally {
      setItemsBusy(false);
    }
  };

  const toggleExpand = async (collectionId) => {
    if (expandedId === collectionId) {
      setExpandedId(null);
      setAddAssetId('');
      return;
    }
    setExpandedId(collectionId);
    setAddAssetId('');
    await loadItems(collectionId);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!canManage || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createCollection({ title, description });
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to create collection');
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (e, collectionId) => {
    e.preventDefault();
    if (!canManage || itemsBusy) return;
    const assetId = normalizeMilAssetId(addAssetId);
    if (!assetId) {
      setError('Enter a valid asset UUID to add');
      return;
    }
    setItemsBusy(true);
    setError(null);
    try {
      await addCollectionItem(collectionId, assetId);
      setAddAssetId('');
      await Promise.all([loadItems(collectionId), load()]);
    } catch (err) {
      setError(err?.message || 'Failed to add asset to collection');
    } finally {
      setItemsBusy(false);
    }
  };

  const removeItem = async (collectionId, assetId) => {
    if (!canManage || itemsBusy) return;
    setItemsBusy(true);
    setError(null);
    try {
      await removeCollectionItem(collectionId, assetId);
      await Promise.all([loadItems(collectionId), load()]);
    } catch (err) {
      setError(err?.message || 'Failed to remove asset from collection');
    } finally {
      setItemsBusy(false);
    }
  };

  const expandedItems = expandedId ? (itemsByCollection[expandedId] || []) : [];

  return (
    <div className="space-y-5 max-w-3xl" data-testid="media-collections">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Collections</h2>
        <p className="text-sm text-slate-600">
          Named sets for website launch, training, GBP, and creator assignments.
          Staff can create collections and manage membership by asset ID in this slice
          (no asset picker yet).
        </p>
      </div>
      {error && <div className="text-sm text-red-700" role="alert">{error}</div>}
      {canManage && (
        <form onSubmit={create} className="rounded-xl border bg-white p-4 space-y-3" data-testid="media-collections-create">
          <label className="block text-sm">
            <span className="font-medium">Title</span>
            <input
              required
              className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Description</span>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
          >
            Create collection
          </button>
        </form>
      )}
      {!canManage && (
        <p className="text-sm text-slate-600 rounded-xl border bg-slate-50 px-4 py-3">
          Browse-only. Library staff can create collections and add or remove member assets.
        </p>
      )}
      <ul className="space-y-2">
        {rows.length === 0 && (
          <li className="rounded-xl border bg-white p-6 text-sm text-slate-600">No collections yet.</li>
        )}
        {rows.map((c) => {
          const count = collectionItemCount(c);
          const open = expandedId === c.id;
          return (
            <li key={c.id} className="rounded-xl border bg-white p-4" data-testid="media-collection-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{c.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{c.description || 'No description'}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    Visibility: {c.visibility} · {count} {count === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm min-h-[44px] text-slate-800"
                  onClick={() => toggleExpand(c.id)}
                  data-testid="media-collection-toggle"
                >
                  {open ? 'Hide members' : (canManage ? 'Manage members' : 'View members')}
                </button>
              </div>
              {open && (
                <div className="mt-4 border-t pt-4 space-y-3" data-testid="media-collection-members">
                  {canManage && (
                    <form
                      onSubmit={(e) => addItem(e, c.id)}
                      className="flex flex-col sm:flex-row gap-2"
                      data-testid="media-collection-add-item"
                    >
                      <label className="block text-sm flex-1 min-w-0">
                        <span className="font-medium">Asset UUID</span>
                        <input
                          className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px] font-mono text-xs"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={addAssetId}
                          onChange={(e) => setAddAssetId(e.target.value)}
                          disabled={itemsBusy}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={itemsBusy}
                        className="rounded-md bg-slate-900 text-white px-4 py-2.5 text-sm min-h-[44px] sm:self-end disabled:opacity-60"
                      >
                        Add asset
                      </button>
                    </form>
                  )}
                  {itemsBusy && expandedItems.length === 0 && (
                    <p className="text-sm text-slate-500">Loading members…</p>
                  )}
                  {!itemsBusy && expandedItems.length === 0 && (
                    <p className="text-sm text-slate-500">No members yet. Add an asset by UUID.</p>
                  )}
                  {expandedItems.length > 0 && (
                    <ul className="space-y-2">
                      {expandedItems.map((item) => {
                        const filename = item.mil_assets?.original_filename || item.asset_id;
                        const kind = item.mil_assets?.media_kind;
                        return (
                          <li
                            key={`${item.collection_id}:${item.asset_id}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                          >
                            <div className="min-w-0 text-sm">
                              <div className="font-medium text-slate-900 truncate">{filename}</div>
                              <div className="text-xs text-slate-500 font-mono break-all">
                                {item.asset_id}
                                {kind ? ` · ${kind}` : ''}
                              </div>
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                disabled={itemsBusy}
                                className="rounded-md border border-red-200 text-red-700 px-3 py-2 text-sm min-h-[44px] disabled:opacity-60"
                                onClick={() => removeItem(c.id, item.asset_id)}
                                data-testid="media-collection-remove-item"
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
