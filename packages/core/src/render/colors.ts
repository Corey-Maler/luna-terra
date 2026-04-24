export const Colors = {
  bg: '#f3f3f3',
  grid: {
    primary: '#c9c9ca',
    secondary: (opacity: number) => `rgba(201, 201, 202, ${opacity})`,
  },
  highway: {
    service: '#b0bbc6',
    tertiary: '#d9d9da',
    default: '#afb5bc',
  },
  //   water: '#90daee'
  water: '#d8d8da',
  rail: '#69727a',
  debug: {
    node: 'red',
    list: [
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#FFFF00',
      '#00FFFF',
      '#FF00FF',
      '#FF8000',
      '#FF0080',
      '#80FF00',
      '#8000FF',
      '#0080FF',
      '#00FF80',
      '#FF80FF',
      '#80FFFF',
      '#FFFF80',
      '#808080',
    ],
  },
  buildings: {
    highlight: {
      // residential: '#9df3da',
      residential: '#9db6f3',
      commercial: '#f3da9d',
      industrial: '#f39db6',
      unknown: '#d9d9da',
    },
    normal: {
      residential: 'gray',
      commercial: 'gray',
      industrial: 'gray',
      unknown: 'gray',
    },
  },
};
