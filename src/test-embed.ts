import { embed } from "./embed";

const [v] = await embed(["Ahoj svet"]);
console.log("dimenzia:", v.length);
console.log("prvých 5 hodnôt:", v.slice(0, 5));
