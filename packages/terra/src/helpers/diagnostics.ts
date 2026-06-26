export class Diagnostics {
  missing: Record<string, Set<string>> = {};

  addMissing(type: string, key: string) {
    if (!this.missing[type]) {
      this.missing[type] = new Set();
    }
    this.missing[type].add(key);
  }

  report() {
    console.log('Missing keys:', this.missing);
  }
}
