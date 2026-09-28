import { Module } from "@nestjs/common";
import { SayabayarClient } from "./sayabayar.client";

@Module({
  providers: [SayabayarClient],
  exports: [SayabayarClient],
})
export class SayabayarModule {}
