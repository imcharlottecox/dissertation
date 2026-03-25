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
    | 'page_load'
    | 'fullscreen_toggle'
    | 'beam_predictions_expanded'
    | 'tab_visibility_change'
    | 'dataset_statement_select'
    | 'node_click'
    | 'checkbox_toggle'
    | 'question_correct'
    | 'zoom_reset'
    | 'accordion_open'
    | 'accordion_close';
export async function logEvent(type: EventType, data?: Record<string, unknown>){
    const student = get(thisStudent);
    if (!student) return;

    await supabase.from('interaction_log').insert({
        student_id: student.id,
        event_type: type,
        event_data: data ?? {}
    })
}

const DEBOUNCE_MS = 600;
 
export function seqLogger(page: string) {
    let timer: ReturnType<typeof setTimeout> | null = null;
 
    return (sequence: string, result: {
        accepted: boolean;
        probability: number;
        questionId: string;
    }) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            logEvent('sequence_input', {
                page,
                sequence,
                accepted: result.accepted,
                probability: result.probability,
                question_id: result.questionId,
            });
        }, DEBOUNCE_MS);
    };
}