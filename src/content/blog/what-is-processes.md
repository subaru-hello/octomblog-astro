---
title: "So, What is The Process?"
date: 2024-07-21T22:30:59+09:00
description: "A process is an instance of a program in execution, which includes the program code and its current activity"
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - computer-science
  - operation-systems
categories:
  - computer-science
image: images/feature2/process-controll-block.jpeg
---

These days, I wonder the art of operation systems.

We often forget that behind the scenes of the computers we use casually, the OS is working hard. To re-recognize this, I want to delve deeper into learning about operating systems. This time, I would like to write about processes, which are started by such OS.

### What is a Process?

First things first, a process is an instance of a program in execution, which includes the program code and its current activity.

It is a fundamental concept in operating systems that enables multitasking by allowing multiple programs to run concurrently. Each process has its own memory space and system resources, and it is managed by the operating system to ensure efficient execution and resource utilization.

### Process Creation

As the previous section describe what the process refers to, it has its own memory space and system resources, so every time the process has created, it eats resources in PC.

But here is the question, when does the process initialized?

Here is some of process creation timings.

1. **System Initialization**:
   - When the computer is powered on, the operating system creates several system processes to manage hardware and software resources. For example, in a Unix-like system, the `init` process (now often replaced by `systemd`) is created first and acts as the parent of all other processes.
2. **User Request**:
   - When you launch an application, a new process is created. For example, opening a web browser creates a new process that runs the browser's executable code.
   - Command Line Example: When you type a command like `python script.py` in a terminal, a new process is created to run the Python interpreter with the specified script.
3. **Batch Job**:
   - In batch processing systems, new processes are created to handle jobs submitted by users or scheduled tasks. For example, a nightly backup job might create a new process to perform the backup operations.
4. **Process Spawning**:
   - A running process can create a new process using system calls. For example, in Unix-like systems, the `fork()` system call is used by a process to create a child process.
   - Example: A web server like Apache might create new processes to handle incoming HTTP requests, allowing it to serve multiple clients concurrently.

Any of those are understandable.

### Process Termination

There is a creation, there is a termination. Here is the end of process life cycle.

1. **Normal Completion**:
   - A process terminates normally when it finishes its execution. For example, a program that calculates and prints the sum of two numbers terminates once the sum is printed.
   - Command Line Example: Running a script that prints "Hello, World!" will terminate after printing the message.
2. **User Request**:
   - A user can terminate a process manually. For example, you can close an application window, which sends a termination signal to the process.
   - Command Line Example: Using the `kill` command to terminate a process by its PID, such as `kill 12345`.
3. **Error/Exception**:
   - A process may terminate due to an error or exception. For example, a process might terminate if it tries to access invalid memory or encounters an unhandled exception.
   - Example: Running a program that tries to divide by zero will typically cause the process to terminate with an error.
4. **System Shutdown**:
   - When the operating system is shutting down, it will terminate all running processes. For example, when you shut down your computer, the OS sends termination signals to all processes to ensure a clean shutdown.
5. **Resource Limits**:
   - A process may be terminated by the operating system if it exceeds certain resource limits, such as memory usage or CPU time. This is often done to prevent a single process from monopolizing system resources.
   - Example: In some systems, a watchdog timer may terminate processes that exceed a set time limit.

These examples illustrate how processes are created and terminated in various scenarios, highlighting the dynamic nature of process management in operating systems.

### Process

The `ps aux` command provides a snapshot of the current running processes with detailed information. Here's a breakdown of the columns and what each represents:

```
USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
```

- **USER**: The username of the user who owns the process.
- **PID**: The process ID, a unique identifier for each running process.
- **%CPU**: The percentage of CPU usage by the process.
- **%MEM**: The percentage of memory (RAM) usage by the process.
- **VSZ**: Virtual memory size of the process (in kilobytes).
- **RSS**: Resident Set Size, the non-swapped physical memory that a task has used (in kilobytes).
- **TTY**: The terminal associated with the process. `?` indicates that the process is not associated with a terminal.
- **STAT**: The current status of the process:
  - **R**: Running
  - **S**: Sleeping
  - **D**: Uninterruptible sleep (usually I/O)
  - **T**: Stopped by job control signal
  - **Z**: Zombie (terminated but not reaped by its parent)
  - Additional characters can indicate other states (e.g., `+` for foreground process group).
- **START**: The time when the process was started.
- **TIME**: The total CPU time the process has used since it started.
- **COMMAND**: The command that started the process, including any arguments.

### Example Output

Let's look at an example output and explain each column:

```
USER PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root 1  0.0  0.1  15820  1084 ? Ss July21   0:01 /sbin/init
```

### Explanation

- `USER`: `root`
- `PID`: `1`
- `%CPU`: `0.0`
- `%MEM`: `0.1`
- `VSZ`: `15820` KB
- `RSS`: `1084` KB
- `TTY`: `?` (no terminal)
- `STAT`: `Ss` (sleeping, session leader)
- `START`: `July21`
- `TIME`: `0:01` (1 second of CPU time)
- `COMMAND`: `/sbin/init` (initialization process, the first process started by the kernel)

this line in the `ps aux` output represents a process, providing detailed information about its resource usage and state. This helps administrators and users monitor and manage the system's processes effectively.

### Sorting With A Specific Resource

ps aux has several options to customize outputs for identify processes for specific reasons.

For example, `--sort=-%cpu` helps to sort the output by CPU usage to quickly identify processes that are consuming the most CPU.

```cpp
$ ps aux --sort=-%cpu

```

**Sorting by Memory Usage**:

Similarly, you can sort the output by memory usage to find processes using the most memory.

```bash
ps aux --sort=-%mem

```

**Filtering Specific Processes**:

If you are looking for a specific process or set of processes, you can use `grep` to filter the output.

```bash
$ ps aux | grep process_name

```

**Identify A Root Cause And Solve Problems**

You may happen to face situations like an application freezing and stacking processes.

- **High CPU Usage**:
  - Look for processes with a high `%CPU` value. These are the processes consuming a lot of CPU time. If a process is consistently at or near 100% CPU usage, it might be causing performance issues.
- **High Memory Usage**:
  - Look for processes with a high `%MEM` value. These processes are using a large portion of the system's memory. If the system is low on available memory, it can cause swapping and slow down the entire system.

After you found the root causes, to free up memory spaces you may well optimize memory usage or kill the processes.

Optimizing resources depend on the situation but killing the processes does not rely on situations, just kill [pid].

### Conclusion

Understanding processes and their lifecycle is essential for effective system administration and troubleshooting. Processes represent instances of programs in execution, and they go through various stages from creation to termination. By using tools like `ps aux` on Linux, you can monitor and manage these processes, ensuring optimal performance and resolving issues such as high CPU or memory usage.

Whether you are dealing with system initialization, user requests, batch jobs, or process spawning, knowing how to create, monitor, and terminate processes is crucial. By sorting and filtering process information, you can quickly identify resource-hungry processes and take appropriate actions to maintain system stability and performance.

### References

- **Process Control Block (PCB) by tutorialspoint** (https://www.tutorialspoint.com/operating_system/os_processes.htm)
- **Difference between Primary and Secondary Memory by geeksforgeeks** (https://www.geeksforgeeks.org/difference-between-primary-and-secondary-memory/)
