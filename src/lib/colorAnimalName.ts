const COLORS = [
  'Red','Blue','Green','Gold','Silver','Purple','Orange','Pink','Teal','Crimson',
  'Azure','Jade','Amber','Violet','Turquoise','Charcoal','Rose','Cerulean','Indigo',
  'Cobalt','Lemon','Mint','Coral','Bronze','Ruby','Sapphire','Emerald','Magenta','Peach',
  'Olive','Navy','Lavender','Sandstone','Apricot','Smoke','Copper','Honey','Rust',
  'Frost','Ink','Sunset','Lagoon',
] as const;

const ANIMALS = [
  'Panda','Tiger','Eagle','Wolf','Fox','Bear','Hawk','Lion','Jaguar','Falcon','Cobra',
  'Dragon','Phoenix','Panther','Raven','Shark','Lynx','Otter','Moose','Gator','Badger',
  'Coyote','Sloth','Turtle','Raccoon','Bison','Viper','Squid','Wolverine','Hyena','Ram',
  'Mustang','Kraken','Griffin','Stingray','Seal','Ocelot','Caribou','Meerkat','Pelican',
  'Orca','Condor','Hippo','Chameleon','Mongoose','Hedgehog','Alpaca','Llama','Buffalo',
  'Ferret','Beetle','Toad','Crow','Goose','Termite','Lobster','Shrimp','Pufferfish',
  'Narwhal','Koala','Gazelle','Porcupine','Platypus','Warthog','Manta','Hammerhead',
] as const;

export function generateRandomColorAnimalName() {
  const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${randomColor}-${randomAnimal}`;
}
