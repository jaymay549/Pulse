import { Flame, TrendingUp, Eye, Share2 } from "lucide-react";

interface TrendingEntry {
  id: number;
  title: string;
  quote: string;
  type: "positive" | "warning";
  category: string;
  views: number;
  shares: number;
}

interface TrendingSectionProps {
  entries: TrendingEntry[];
  onEntryClick: (entryId: number) => void;
}

const TrendingSection = ({ entries, onEntryClick }: TrendingSectionProps) => {
  if (entries.length === 0) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case "positive": return "bg-green-500/20 text-green-600 border-green-500/30";
      case "warning": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "positive": return "WIN";
      case "warning": return "WARNING";
      default: return "";
    }
  };

  return (
    <section className="py-6 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-orange-500/5 border-y border-orange-500/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-600">Trending Reviews</span>
            </div>
            <TrendingUp className="h-4 w-4 text-orange-500/60" />
          </div>
          <span className="text-xs text-muted-foreground">Most viewed this week</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {entries.map((entry, index) => (
            <button
              key={entry.id}
              onClick={() => onEntryClick(entry.id)}
              className="group relative flex-shrink-0 w-72 p-4 rounded-xl bg-card border border-border hover:border-orange-500/50 hover:shadow-lg transition-all text-left"
            >
              {/* Rank badge */}
              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black shadow-lg">
                {index + 1}
              </div>
              
              {/* Type badge */}
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border mb-2 ${getTypeColor(entry.type)}`}>
                {getTypeLabel(entry.type)}
              </div>
              
              {/* Title */}
              <h4 className="font-bold text-foreground text-sm line-clamp-2 mb-2 group-hover:text-orange-600 transition-colors">
                {entry.title}
              </h4>
              
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {entry.views.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  {entry.shares}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
