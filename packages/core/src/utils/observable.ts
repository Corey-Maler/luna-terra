export class Observable<T> {
  public observers = new Set<(value: T) => void>();

  public subscribe(observer: (value: T) => void) {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  public next(data: T) {
    this.observers.forEach((observer) => {
      observer(data);
    });
  }
}
