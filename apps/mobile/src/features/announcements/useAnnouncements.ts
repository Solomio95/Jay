import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface Announcement {
    id: string;
    title: string;
    body: string;
    starts_on: string;
    ends_on: string | null;
}

export const useAnnouncements = () => {
    const [items, setItems] = useState<Announcement[]>([]);
    useEffect(() => {
        let active = true;
        supabase.rpc("my_announcements").then(({ data }) => {
            if (active && data) setItems(data as Announcement[]);
        });
        return () => {
            active = false;
        };
    }, []);
    return items;
};
