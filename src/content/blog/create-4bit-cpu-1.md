---
title: "Create a 4bit CPU ①"
date: 2024-06-02T13:38:17+09:00
description: "[CPU] create a 4bit CPU -part1-"
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - computer-science
  - cpu
categories:
  - computer-science
series:
  - はじめて読む486
image: images/feature2/td4-book.jpeg
---

Finally, every parts I ordered these days for a creation of 4 bit CPU has delivered to me now!

![](https://storage.googleapis.com/zenn-user-upload/3372699dee04-20240602.png)

It has been long time to touch the Handagote since my junior high (12years? wow).

I am really looking forward to finish creating a 4bit CPU..!

Well, let me show you the parts I ordered.

## What I Plan to Build

![](https://storage.googleapis.com/zenn-user-upload/d85840af4cbf-20240602.png)
My goal is to build a CPU with a few core functions written in the above book.
The CPU will:

Fetch an operation from RAM.
Decode the operation.
Execute the decoded operation in the ALU (Arithmetic Logic Unit).
Store the result in the program counter (PC) and the registers.
This simplified CPU will demonstrate the fundamental principles of CPU operation, focusing on fetching, decoding, executing instructions, and storing results.

## Overview of the 4bit CPU

![](https://storage.googleapis.com/zenn-user-upload/23865a721077-20240602.png)

I will walk you through the creation of a 4-bit CPU from scratch. Below is an overview of the key components and their functions:

- **Inputs**: The CPU has 6 inputs - 4 Load inputs and 2 Select inputs. These inputs correspond to 6-bit signals that handle operation codes, something like `10010000` which equals to the opcode`MOV A` and `Im` which refers to transfering immediate value to the register A.
- **Clock Signal**: The clock signal is crucial for synchronizing the CPU's operations.
- **Registers**: The CPU includes 4 registers. The 74HC161 IC chip, which acts as a flip-flop, functions as a register. One of these registers serves as the program counter.
- **Operation Decoder**: The operation decoder consists of three 74HC32 IC chips and three 74HC10 chips. It decodes the operation codes fetched from the memory (ROM in this case, acting as RAM).
- **ROM**: The ROM holds 16-bit addresses and stores the instructions for the CPU.
- **ALU (Arithmetic Logic Unit)**: The ALU is made up of two 74HC153 IC chips that perform computations on two values - one from the ROM and the other from a selected register.
- **Reset Switch**: The reset switch initializes the CPU by resetting all components when the power is turned on.
- **Carry Flag**: The carry flag is managed by a 74HC74 IC chip. It is used for conditional operations and is set to true when the flag denotes 1.
- **Power Supply**: The power supply retains electric power, functioning as a battery unless the reset button is pressed.
- **Buzzer**: The buzzer sounds an alert when specific conditions are met.

Creating this 4-bit CPU involves numerous steps and attention to detail, but the result is a fully functional, custom-designed CPU.

Stay tuned for the detailed steps and explanations in the next sections.
