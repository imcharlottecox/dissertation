import {supabase} from './supabase';
import {get} from 'svelte/store';
import {thisStudent} from './auth';
type EventType =
    | 'drag_node'
    | 'semantic_zoom'
    | 'subgraph_expand'
    | 'subgraph_collapse'
    | 'sequence_input'
    | 'next_question'
    | 'back_question'
    | 'page_load';

export async function logEvent(type: EventType, data?: Record<string, unknown>){
    const student = get(thisStudent);
    if (!student) return;

    await supabase.from('interaction_log').insert({
        student_id: student.id,
        event_type: type,
        event_data: data ?? {}
    })
}