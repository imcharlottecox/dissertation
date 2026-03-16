import {supabase} from './supabase';
import {writable} from 'svelte/store';

export const thisStudent = writable<{ id: string; username: string }|null>(null);

export async function studentLogin(username: string): Promise<boolean>{
    const {data, error} = await supabase
        .from('students')
        .select('id, username')
        .eq('username', username.toLowerCase().trim())
        .single();

    if (error || !data) return false;
    thisStudent.set(data);
    //use local storage to persist across pages and refreshes
    localStorage.setItem('student_id', data.id);
    localStorage.setItem('student_username', data.username);
    return true;
 }

export async function restoreSession(){
    const id = localStorage.getItem('student_id');
    const username = localStorage.getItem('student_username');
    if (id && username) {
        thisStudent.set({ id, username });
    }
}

export function logout(){
    thisStudent.set(null);
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_username');
}