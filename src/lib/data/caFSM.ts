export type Transition = { from: string; to: string; label: string };

export function makeCaFSM() {

    const acceptingStates = [
        'Cat', 'Car', 'Cart', 'Carton', 'Cats', 'Cars', 'Carts', 'Cartons', 'ACCEPT'
    ];
    const startingStates = [
        'START'
    ];
    const fsmStates = [
        'START',
        'C',
        'Ca', 
        
        'Cat',  
        'Cats', 
        
        'Car',  
        'Cars', 

        'Cart',  
        'Carts', 

        'Carto', 
        'Carton', 
        'Cartons', 

    ];

    const fsmTransitions: Transition[] = [
        { from: 'START', to: 'C', label: 'C' },
        { from: 'C', to: 'Ca', label: 'a' },
        { from: 'Ca', to: 'Cat', label: 't' },
        { from: 'Ca', to: 'Car', label: 'r' },
        { from: 'Cat', to: 'ACCEPT', label: 'END' },
        { from: 'Cat', to: 'Cats', label: 's' },
        { from: 'Cats', to: 'ACCEPT', label: 'END' },
        { from: 'Car', to: 'ACCEPT', label: 'END' },
        { from: 'Car', to: 'Cart', label: 't' },
        { from: 'Car', to: 'Cars', label: 's' },
        { from: 'Cars', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'Carts', label: 's' },
        { from: 'Carts', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'Carto', label: 'o' },
        { from: 'Carto', to: 'Carton', label: 'n' },
        { from: 'Carton', to: 'ACCEPT', label: 'END' },
        { from: 'Carton', to: 'Cartons', label: 's' },
        { from: 'Cartons', to: 'ACCEPT', label: 'END' }
    ];
    
  return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}
