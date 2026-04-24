import { V2 } from '@lunaterra/math';

export class ViewPort {
  public width: number;
  public height: number;
  public HDPI: number = window.devicePixelRatio || 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public get virtualWidth(): number {
    return this.width / this.HDPI;
  }

  public get virtualHeight(): number {
    return this.height / this.HDPI;
  }

  public get viewPort(): V2 {
    return new V2(this.width, this.height);
  }

  public get viewPortRatio(): number {
    return this.width / this.height;
  }

  public update(width: number, height: number): void {
    this.HDPI = window.devicePixelRatio || 1;
    this.width = width * this.HDPI;
    this.height = height * this.HDPI;
  }
}
