import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownAZ, CalendarArrowDown, ChevronDown, Clock, ExternalLink, Heart, ListFilter, Loader2, Music2, Plus, Search, TrendingUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const FAVORITES_KEY = "cp_favorite_songs";
const SORT_KEY = "cp_songs_sort";

const SORT_OPTIONS: { value: CpSongSortField; label: string; icon: React.ReactNode }[] = [
  { value: "title",     label: "Titre",     icon: <ArrowDownAZ className="h-3 w-3" /> },
  { value: "artist",    label: "Artiste",   icon: <ArrowDownAZ className="h-3 w-3" /> },
  { value: "updatedAt", label: "Modifié",   icon: <Clock className="h-3 w-3" /> },
  { value: "createdAt", label: "Ajouté",    icon: <CalendarArrowDown className="h-3 w-3" /> },
];

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

function loadSort(): CpSongSortField {
  const raw = localStorage.getItem(SORT_KEY);
  if (raw === "title" || raw === "artist" || raw === "updatedAt" || raw === "createdAt") return raw;
  return "title";
}
function saveSort(s: CpSongSortField) {
  localStorage.setItem(SORT_KEY, s);
}

interface SongsTabProps {
  onCreateSong?: () => void;
  onSelectSong?: (id: string) => void;
  selectedSongId?: string | null;
}

export function SongsTab({ onCreateSong, onSelectSong, selectedSongId }: SongsTabProps) {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<CpSongListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadFavorites());
  const [frequentSongs, setFrequentSongs] = useState<CpSongListItem[]>([]);
  const [sortBy, setSortBy] = useState<CpSongSortField>(() => loadSort());

  const loadSongs = useCallback(async (q: string, sort: CpSongSortField) => {
    setLoading(true);
    try {
      const list = await window.cp.songs.list(q || undefined, sort);
      setSongs(list);
    } catch {
      toast.error("Impossible de charger les chants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSongs("", sortBy);
  }, [loadSongs, sortBy]);

  useEffect(() => {
    window.cp.songs.getFrequent(8).then(setFrequentSongs).catch(() => null);
  }, []);

  const handleSortChange = useCallback((next: CpSongSortField) => {
    setSortBy(next);
    saveSort(next);
  }, []);

  // 150ms debounce per UX spec
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void loadSongs(value, sortBy), 150);
  }, [loadSongs, sortBy]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    void loadSongs("", sortBy);
  }, [loadSongs, sortBy]);

  const handleImport = useCallback(async () => {
    const result = await window.cp.songs.importAuto();
    if (!result.ok) return;
    if (result.imported === 0) { toast.info("Aucun chant importé"); return; }
    toast.success(`${result.imported} chant${result.imported !== 1 ? "s" : ""} importé${result.imported !== 1 ? "s" : ""}`);
    void loadSongs(query, sortBy);
  }, [loadSongs, query, sortBy]);

  const handleToggleFavorite = useCallback((songId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      saveFavorites(next);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search + sort */}
      <div className="px-3 py-2 border-b border-border space-y-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <Input
            placeholder="Rechercher un chant…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 pr-7 h-8 text-sm"
          />
          {query && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              onClick={handleClearSearch}
              aria-label="Effacer la recherche"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-elevated hover:text-text-secondary transition-colors"
              aria-label="Changer le tri"
            >
              <ListFilter className="h-3 w-3" />
              <span>Trier : <span className="text-text-primary">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span></span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className={cn(sortBy === opt.value && "font-semibold text-primary")}
                onClick={() => handleSortChange(opt.value)}
              >
                {opt.icon}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-text-muted px-4 text-center">
            <Music2 className="h-10 w-10 opacity-30" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-secondary">
                {query ? "Aucun résultat" : "Aucun chant"}
              </p>
                  <p className="text-sm leading-relaxed">
                {query
                  ? `Aucun chant trouvé pour « ${query} »`
                  : "Crée ton premier chant ou importe une bibliothèque."}
              </p>
            </div>
            {!query && (
              <div className="flex gap-2 mt-1 flex-wrap justify-center">
                {onCreateSong && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={onCreateSong}>
                    <Plus className="h-3.5 w-3.5" />
                    Nouveau chant
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1.5 text-text-secondary" onClick={() => void handleImport()}>
                  <Upload className="h-3.5 w-3.5" />
                  Importer
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-1">
            {/* Favoris section */}
            {!query && favoriteIds.size > 0 && (() => {
              const favSongs = songs.filter((s) => favoriteIds.has(s.id));
              if (favSongs.length === 0) return null;
              return (
                <>
                  <p className="flex items-center gap-1 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <Heart className="h-2.5 w-2.5 fill-danger text-danger" />
                    Favoris
                  </p>
                  {favSongs.map((song) => (
                    <SongRow
                      key={`fav-${song.id}`}
                      song={song}
                      isFavorite={true}
                      isSelected={selectedSongId === song.id}
                      onSelect={() => onSelectSong?.(song.id)}
                      onToggleFavorite={() => handleToggleFavorite(song.id)}
                    />
                  ))}
                  <div className="border-t border-border/50 my-1" />
                </>
              );
            })()}

            {/* Fréquents section */}
            {!query && frequentSongs.length > 0 && (() => {
              const nonFav = frequentSongs.filter((s) => !favoriteIds.has(s.id));
              if (nonFav.length === 0) return null;
              return (
                <>
                  <p className="flex items-center gap-1 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <TrendingUp className="h-2.5 w-2.5" />
                    Fréquents
                  </p>
                  {nonFav.slice(0, 5).map((song) => (
                    <SongRow
                      key={`freq-${song.id}`}
                      song={song}
                      isFavorite={favoriteIds.has(song.id)}
                      isSelected={selectedSongId === song.id}
                      onSelect={() => onSelectSong?.(song.id)}
                      onToggleFavorite={() => handleToggleFavorite(song.id)}
                    />
                  ))}
                  <div className="border-t border-border/50 my-1" />
                </>
              );
            })()}

            {/* Full list */}
            {(!query
              ? songs.filter((s) => !favoriteIds.has(s.id))
              : songs
            ).map((song) => (
              <SongRow
                key={song.id}
                song={song}
                isFavorite={favoriteIds.has(song.id)}
                isSelected={selectedSongId === song.id}
                onSelect={() => onSelectSong?.(song.id)}
                onToggleFavorite={() => handleToggleFavorite(song.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between shrink-0">
        <span className="text-xs text-text-muted">
          {loading ? "…" : query
            ? `${songs.length} résultat${songs.length !== 1 ? "s" : ""}`
            : `${songs.length} chant${songs.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="xs" className="gap-1 text-text-muted hover:text-text-secondary" onClick={() => void handleImport()} title="Importer JSON / Word" aria-label="Importer des chants">
            <Upload className="h-3 w-3" />
          </Button>
          {onCreateSong && (
            <Button variant="ghost" size="xs" className="gap-1 text-text-secondary" onClick={onCreateSong}>
              <Plus className="h-3 w-3" />
              Nouveau
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SongRowProps {
  song: CpSongListItem;
  isFavorite: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function SongRow({ song, isFavorite, isSelected, onSelect, onToggleFavorite }: SongRowProps) {
  return (
    <div
      className={cn(
        "group/song flex items-center border-y border-transparent transition-colors",
        isSelected
          ? "border-primary/20 bg-primary/8"
          : "hover:bg-bg-elevated"
      )}
    >
      <button
        type="button"
        className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left"
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate leading-snug">{song.title}</p>
          {song.artist && (
            <p className="text-xs text-text-muted truncate leading-snug">{song.artist}</p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1 pr-2">
        <Button
          variant="ghost"
          size="xs"
          className={cn(
            "gap-1 rounded-lg text-text-secondary",
            isSelected && "text-primary"
          )}
          onClick={onSelect}
          aria-label={`Ouvrir le detail de ${song.title}`}
        >
          <ExternalLink className="h-3 w-3" />
          Ouvrir
        </Button>
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors hover:bg-bg-elevated hover:text-text-primary",
            isFavorite ? "text-danger" : "text-text-muted"
          )}
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={isFavorite || undefined}
        >
          <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
        </button>
      </div>
    </div>
  );
}
