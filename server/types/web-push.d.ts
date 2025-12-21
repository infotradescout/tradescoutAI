declare module 'web-push' {
  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: any, payload?: string | Buffer, options?: any): Promise<any>;
  }

  const webPush: WebPush;
  export default webPush;
}
