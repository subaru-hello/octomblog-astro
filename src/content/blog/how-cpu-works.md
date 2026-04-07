---
title: "The Overview Of A CPU"
description: "【CPU】Fill your curiosity towards a central unit."
date: 2024-05-18T23:16:51+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - computer-science
  - mechanism
categories:
  - computer-science
series:
  - はじめて読む486
image: images/feature2/cpu.jpeg
---

I am reading a book about creating a CPU. However, when it comes to actually making one, I realized I need to understand what a CPU is in the first place. So, I decided to summarize an overview of it.
The process of a CPU executing calculations and storing the results in main memory is divided into four steps, coordinated by a control mechanism. It comprised of Fetch, Decode, Execute, and Store phases. With each change in the clock signal, the process advances to the next step.
![](https://storage.googleapis.com/zenn-user-upload/4b2592be5fd1-20240521.png)
Let’s explore more details of each functions.

## CPU Processes

### Clock

Each processes in a CPU operates sequentially with each tick of the clock.

For instance, when the clock switches to a high state(H), the CPU fetches a value from RAM. When the clock switches to a low (L) state, the CPU decodes the fetched value to determine the instructions needed to execute the program.

The clock then switches back to high (H) for the next process, and this cycle continues.

Although understanding the clock mechanism is crucial in handling CPU processes, we will keep it at a high-level overview here.

### Fetch

![](https://storage.googleapis.com/zenn-user-upload/541c462bdde7-20240521.png)

the basic CPU has mainly 3 steps as the former section touched.

In the fetching step, the CPU retrieves next instruction from RAM.

This instruction is typically located at the address specified by the program counter(PC), which points to the next instruction to be executed.

The CPU sends a signal to RAM requesting the instruction located at memory address indicated by a program counter.

In this scenario, the program counter indicates 0, thus, the CPU requests the RAM to response a next instruction at the 0 address. The RAM response a instruction `LOAD 6`, the CPU locad the instruction to an IR(instruction register) for further process.

### Decode

![](https://storage.googleapis.com/zenn-user-upload/47d894a7708e-20240521.png)

Once the instruction has successfully loaded into the IR, the CPU needs to decode it to understand what operation needs to be executed.

The instruction typically consists of an operation code (opcode) and possibly one or more operands. These can include operations such as addition, subtraction, loading data from specific addresses, storing data to memory, etc.

The CPU has a built-in understanding of different opcodes and their meanings. Once the opcode is determined, the CPU decodes the operands, which specify the data involved in the operation. These operands could be memory addresses, register values, or immediate values like magic numbers.

The type of operand addressing mode can vary, such as register addressing, direct addressing, indirect addressing, etc. The CPU decodes the operand addressing mode to determine how to access the data.

Based on the opcode and the decoded operands, the CPU generates control signals that direct the flow of data and operations within the CPU. These control signals activate various components of the CPU, such as the ALU (Arithmetic Logic Unit), registers, memory interfaces, etc., to execute the instruction.

One important detail is that an instruction like "add two numbers" might be represented in **binary code** as a sequence of bits that the CPU interprets as the "ADD" opcode followed by the binary representation of the memory addresses or register numbers containing the operands.

In this scenario, since the opcode is "LOAD 6" (represented in binary code, but interpreted for simplicity), "LOAD 6" is loaded into the IR.

### Execute

After decoding the instruction, the CPU executes the operation specified by the value registered in the instruction register.
![](https://storage.googleapis.com/zenn-user-upload/9b11aac24b51-20240521.png)

In the executing phase, the CPU performs the operation indicated by the opcode. This could involve arithmetic operations like addition or subtraction, logical operations, data transfer operations like loading data from memory to a register, or storing data from a register to memory.

![](https://storage.googleapis.com/zenn-user-upload/e12e0fcf5c94-20240521.png)

the illustration of ALU

Source: [Webedu](https://webeduclick.com/block-diagram-of-computer-system/)

For instance, if the operation is an arithmetic one, such as adding two numbers, the CPU will send the appropriate control signals to the ALU (Arithmetic Logic Unit). The ALU will then perform the addition operation on the operands, and the result will be stored in a specified register, often called the accumulator.

In this specific scenario, the "LOAD 6" instruction is executed by setting the output to the accumulator. This means that the value '6' is loaded into the accumulator register, making it available for subsequent operations.

The execution phase ensures that the operation specified by the instruction is carried out correctly, and the result is stored in the appropriate place for future use.

### Store

After the execution phase, the CPU stores the executed output to main memory basically it is a RAM, random access memory.

In the storing phase, the result of the executed instruction is written back to a specified location. This could be a register, a memory address, or any other designated storage area within the CPU or system memory.

For example, if the instruction involved an arithmetic operation and the result is in the accumulator, the storing phase will move this result from the accumulator to a specific register or memory address. This ensures that the result of the computation is saved and can be accessed by subsequent instructions or processes.

The storing phase is essential to maintain data consistency and ensure that the results of executed instructions are available for future operations.

## Summary

A CPU primarily performs four processes: fetching an instruction written in byte code, decoding the instruction, executing the decoded instruction, and storing the output to the designated address specified by the operand in the instruction.

I feel like I've grasped the basic outline of how a CPU works. Next time, we will actually start building a CPU.

## References

https://www.youtube.com/watch?v=Z5JC9Ve1sfI
