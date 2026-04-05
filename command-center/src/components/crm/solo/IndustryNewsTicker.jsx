import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Newspaper, ExternalLink, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const IndustryNewsTicker = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      // 1. Try to get news from DB first
      const { data, error } = await supabase
        .from('industry_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // 2. If no news found (first run), trigger the edge function
      if (!data || data.length === 0) {
        await refreshNewsSource();
      } else {
        setNews(data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshNewsSource = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-industry-news');
      if (error) throw error;
      
      // Re-fetch from DB after update
      const { data } = await supabase
        .from('industry_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);
        
      if (data) setNews(data);
      
      toast({
        title: "News Feed Updated",
        description: "Latest industry headlines have been retrieved.",
      });
    } catch (error) {
      console.error('Error refreshing news:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not fetch fresh news at this time.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-1.5 rounded-md">
            <Newspaper className="w-4 h-4 text-blue-600" />
          </div>
          <CardTitle className="text-sm font-bold text-slate-800">Industry Pulse</CardTitle>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-slate-400 hover:text-blue-600" 
          onClick={refreshNewsSource}
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 p-0">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="space-y-2 animate-pulse">
                 <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                 <div className="h-3 bg-slate-50 rounded w-1/2"></div>
               </div>
             ))}
          </div>
        ) : news.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            No news available. Click refresh to fetch latest articles.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="flex flex-col divide-y divide-slate-100">
              {news.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] py-0 h-5 px-1.5 font-normal text-slate-500 border-slate-200 bg-slate-50">
                      {item.topic || 'General'}
                    </Badge>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block font-medium text-sm text-slate-700 leading-snug group-hover:text-blue-600 transition-colors mb-1.5 line-clamp-2"
                  >
                    {item.title}
                  </a>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                       {item.source}
                    </span>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
              
              <div className="p-3 bg-slate-50 text-center">
                 <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                   <TrendingUp className="w-3 h-3" />
                   Powered by Google News
                 </p>
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default IndustryNewsTicker;