FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["src/ExhibitionLeads.Api/ExhibitionLeads.Api.csproj", "src/ExhibitionLeads.Api/"]
COPY ["src/ExhibitionLeads.Core/ExhibitionLeads.Core.csproj", "src/ExhibitionLeads.Core/"]
COPY ["src/ExhibitionLeads.Infrastructure/ExhibitionLeads.Infrastructure.csproj", "src/ExhibitionLeads.Infrastructure/"]

RUN dotnet restore "src/ExhibitionLeads.Api/ExhibitionLeads.Api.csproj"

# Copy full source and build
COPY . .
WORKDIR "/src/src/ExhibitionLeads.Api"
RUN dotnet build "ExhibitionLeads.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ExhibitionLeads.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "ExhibitionLeads.Api.dll"]
