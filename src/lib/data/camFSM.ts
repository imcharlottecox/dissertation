export type Transition = { from: string; to: string; label: string };

export function makeCamFSM() {
    const startingStates: string[] = ['START'];

    const acceptingStates: string[] = [
        'Cat','Car','Caress','Cattle','Cambridge','Carton','Cart','Carts','Cats',
        'Cars','Caresses','Cartons','Cartwheel','Caramel','ACCEPT', 'Care', 'Cares'
    ];

    const fsmStates: string[] = [
        'START','C','Ca',
        'Cat','Cats','Catt','Cattl','Cattle',
        'Car','Cars',
        'Cara','Caram','Carame','Caramel',
        'Care','Cares','Caress','Caresse','Caresses',
        'Cart','Carts','Carto','Carton','Cartons',
        'Cartw','Cartwh','Cartwhe','Cartwhee','Cartwheel',
        'Cam','Camb','Cambr','Cambri','Cambrid','Cambridg','Cambridge',
        //   'ACCEPT'
    ];

    const fsmTransitions: Transition[] = [
        { from: 'START', to: 'C', label: 'C' },
        { from: 'C', to: 'Ca', label: 'a' },

        { from: 'Ca', to: 'Cat', label: 't' },
        { from: 'Cat', to: 'ACCEPT', label: 'END' },
        { from: 'Cat', to: 'Cats', label: 's' },
        { from: 'Cats', to: 'ACCEPT', label: 'END' },

        { from: 'Cat', to: 'Catt', label: 't' },
        { from: 'Catt', to: 'Cattl', label: 'l' },
        { from: 'Cattl', to: 'Cattle', label: 'e' },
        { from: 'Cattle', to: 'ACCEPT', label: 'END' },

        { from: 'Ca', to: 'Car', label: 'r' },
        { from: 'Car', to: 'ACCEPT', label: 'END' },

        { from: 'Car', to: 'Cars', label: 's' },
        { from: 'Cars', to: 'ACCEPT', label: 'END' },

        { from: 'Car', to: 'Cara', label: 'a' },
        { from: 'Cara', to: 'Caram', label: 'm' },
        { from: 'Caram', to: 'Carame', label: 'e' },
        { from: 'Carame', to: 'Caramel', label: 'l' },
        { from: 'Caramel', to: 'ACCEPT', label: 'END' },

        { from: 'Car', to: 'Care', label: 'e' },
        { from: 'Care', to: 'Cares', label: 's' },
        { from: 'Cares', to: 'Caress', label: 's' },
        { from: 'Caress', to: 'ACCEPT', label: 'END' },
        { from: 'Caress', to: 'Caresse', label: 'e' },
        { from: 'Caresse', to: 'Caresses', label: 's' },
        { from: 'Caresses', to: 'ACCEPT', label: 'END' },

        { from: 'Car', to: 'Cart', label: 't' },
        { from: 'Cart', to: 'ACCEPT', label: 'END' },
        { from: 'Cart', to: 'Carts', label: 's' },
        { from: 'Carts', to: 'ACCEPT', label: 'END' },

        { from: 'Cart', to: 'Carto', label: 'o' },
        { from: 'Carto', to: 'Carton', label: 'n' },
        { from: 'Carton', to: 'ACCEPT', label: 'END' },
        { from: 'Carton', to: 'Cartons', label: 's' },
        { from: 'Cartons', to: 'ACCEPT', label: 'END' },

        { from: 'Cart', to: 'Cartw', label: 'w' },
        { from: 'Cartw', to: 'Cartwh', label: 'h' },
        { from: 'Cartwh', to: 'Cartwhe', label: 'e' },
        { from: 'Cartwhe', to: 'Cartwhee', label: 'e' },
        { from: 'Cartwhee', to: 'Cartwheel', label: 'l' },
        { from: 'Cartwheel', to: 'ACCEPT', label: 'END' },

        { from: 'Ca', to: 'Cam', label: 'm' },
        { from: 'Cam', to: 'Camb', label: 'b' },
        { from: 'Camb', to: 'Cambr', label: 'r' },
        { from: 'Cambr', to: 'Cambri', label: 'i' },
        { from: 'Cambri', to: 'Cambrid', label: 'd' },
        { from: 'Cambrid', to: 'Cambridg', label: 'g' },
        { from: 'Cambridg', to: 'Cambridge', label: 'e' },
        { from: 'Cambridge', to: 'ACCEPT', label: 'END' },
    ];
  
    return { fsmStates, fsmTransitions, acceptingStates, startingStates };
}





