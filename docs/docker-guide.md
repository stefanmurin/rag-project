# Docker Architecture and Container Management

Docker is an open platform for developing, shipping, and running applications. It enables you to separate your applications from your infrastructure so you can deliver software quickly.

## Docker Architecture

Docker uses a client-server architecture. The Docker client talks to the Docker daemon (`dockerd`), which does the heavy lifting of building, running, and distributing your Docker containers. The Docker client and daemon can run on the same system, or you can connect a Docker client to a remote Docker daemon.

Communication happens via a REST API over UNIX sockets or a network interface. Another Docker client is Docker Compose, which allows you to work with applications consisting of a set of containers.

## Docker Engine Components

The Docker Engine consists of three primary components:
1. A server which is a type of long-running program called a daemon process (`dockerd`).
2. A REST API which specifies interfaces that programs can use to talk to the daemon.
3. A command line interface (CLI) client (`docker`).

## Storage Drivers and Volumes

Docker offers multiple ways to persist data:
- Volumes: Stored in a part of the host filesystem managed by Docker (`/var/lib/docker/volumes/` on Linux). Non-Docker processes should not modify this filesystem directory. Volumes are the best way to persist data in Docker.
- Bind Mounts: Can be stored anywhere on the host system. They may be sensitive or critical system files. Non-Docker processes on the Docker host or a Docker container can modify them at any time.
- tmpfs mounts: Stored in the host system's memory only, and are never written to the host system's filesystem.

## Container Lifecycle Commands

To manage container lifecycle states effectively:
- `docker create`: Creates a container without starting it.
- `docker start`: Starts any stopped containers.
- `docker run`: Creates and starts a container in a single operation.
- `docker stop -t 30`: Sends SIGTERM and waits 30 seconds before sending SIGKILL.
- `docker pause`: Freezes container processes using cgroups freezer subsystem.
