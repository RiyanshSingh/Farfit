// @ts-nocheck
import { createClient } from '@supabase/supabase-js'

// Using provided anon key from user
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ppcecyksmynutvhbzxyq.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwY2VjeWtzbXludXR2aGJ6eHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzk3MDEsImV4cCI6MjA5MTY1NTcwMX0._zs_bcJlZgPSrjlG8BCDWup95Cv3UgtiqjEJjip34DA'

// Mock builder to handle chaining like .from().upsert().select()
const createMockBuilder = () => {
    const builder = {
        data: null,
        error: null,
        from: () => builder,
        select: () => builder,
        insert: () => builder,
        upsert: () => builder,
        update: () => builder,
        delete: () => builder,
        eq: () => builder,
        single: () => builder,
        order: () => builder,
        limit: () => builder,
        // Make it thenable so 'await' works at any point in the chain
        then: (onfulfilled) => {
            return Promise.resolve({ data: builder.data, error: builder.error }).then(onfulfilled);
        }
    };
    return builder;
};

export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createMockBuilder();
