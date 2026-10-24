function greet(name) {
  return `Hello, ${name}!`;
}

const names = ["Alice", "Bob", "Charlie"];

for (const name of names) {
  console.log(greet(name));
}
